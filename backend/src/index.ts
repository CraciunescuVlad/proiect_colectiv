import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import cron from "node-cron";
import { exec } from "child_process";
import createDashboardRouter from "./routes/dashboard";
import createMapRouter from "./routes/map";
import createUsersRouter from "./routes/users";
import createStatisticsRouter from "./routes/statistics";
import { requireAdmin, requireAuth } from "./middleware/auth";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

// Supabase client (service role — backend only)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const sendEmail = (to: string, subject: string, text: string) =>
  emailTransporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text });

const sendHtmlEmail = (to: string, subject: string, html: string) =>
  emailTransporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html });

const staticMapUrl = (lat: number, lng: number) =>
  `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-l+ef4444(${lng},${lat})/${lng},${lat},14,0/600x300@2x?access_token=${process.env.MAPBOX_TOKEN}`;

async function getIncidentEmailData(incidentId: string) {
    const { data: incident } = await supabase
        .from("incidents")
        .select("incident_id, status, start_time, end_time, priority, assigned_to")
        .eq("incident_id", incidentId)
        .single();

    const { data: incidentAlarms } = await supabase
        .from("incident_alarms")
        .select("alarm_id")
        .eq("incident_id", incidentId);

    const alarmIds = incidentAlarms?.map((ia: any) => ia.alarm_id) ?? [];

    const { data: alarms } = await supabase
        .from("alarms")
        .select("alarm_id, site, tehnologie, type, status")
        .in("alarm_id", alarmIds.length ? alarmIds : [0]);

    const firstSite = alarms?.[0]?.site ?? null;
    let site = null;
    if (firstSite) {
        const { data: siteData } = await supabase
            .from("site")
            .select("latitudine, longitude, city, address")
            .eq("id", firstSite)
            .single();
        site = siteData;
    }

    return { incident, alarms: alarms ?? [], site, firstSite };
}

function buildAssignmentEmail(incidentId: string, incident: any, alarms: any[], site: any): string {
    const mapImg = site
        ? `<img src="${staticMapUrl(site.latitudine, site.longitude)}" width="600" style="border-radius:8px;display:block;margin:16px 0;" alt="Incident location"/>`
        : "";
    const alarmRows = alarms.map(a =>
        `<tr><td style="padding:6px 10px;color:#94a3b8;">${a.tehnologie} · ${a.type}</td><td style="padding:6px 10px;color:#94a3b8;">${a.site}</td><td style="padding:6px 10px;color:${a.status === 1 ? "#f87171" : "#4ade80"};">${a.status === 1 ? "Active" : "Resolved"}</td></tr>`
    ).join("");

    return `
<div style="background:#0f0a1e;font-family:sans-serif;padding:32px;max-width:640px;margin:auto;border-radius:12px;">
  <h2 style="color:#fff;margin-bottom:4px;">You've been assigned to an incident</h2>
  <p style="color:#6b7280;margin-top:0;">AlarmUP · Incident <strong style="color:#a78bfa;">INC${incidentId}</strong></p>

  <table style="width:100%;border-collapse:collapse;margin:20px 0;">
    <tr><td style="color:#6b7280;padding:6px 0;width:130px;">Priority</td><td style="color:#fff;">${incident?.priority ?? "—"}</td></tr>
    <tr><td style="color:#6b7280;padding:6px 0;">Status</td><td style="color:${incident?.status === 1 ? "#f87171" : "#4ade80"};">${incident?.status === 1 ? "Active" : "Resolved"}</td></tr>
    <tr><td style="color:#6b7280;padding:6px 0;">Start time</td><td style="color:#fff;">${incident?.start_time ? new Date(incident.start_time).toLocaleString() : "—"}</td></tr>
    <tr><td style="color:#6b7280;padding:6px 0;">Location</td><td style="color:#fff;">${site ? `${site.city ?? ""} — ${site.address ?? ""}` : "—"}</td></tr>
  </table>

  ${mapImg}

  ${alarms.length ? `
  <h3 style="color:#fff;margin-bottom:8px;">Related Alarms (${alarms.length})</h3>
  <table style="width:100%;border-collapse:collapse;background:#1a1030;border-radius:8px;overflow:hidden;">
    <thead><tr style="background:#2d1f4e;">
      <th style="padding:8px 10px;color:#a78bfa;text-align:left;font-size:12px;">Technology</th>
      <th style="padding:8px 10px;color:#a78bfa;text-align:left;font-size:12px;">Site</th>
      <th style="padding:8px 10px;color:#a78bfa;text-align:left;font-size:12px;">Status</th>
    </tr></thead>
    <tbody>${alarmRows}</tbody>
  </table>` : ""}

  <p style="color:#4b5563;font-size:12px;margin-top:24px;">AlarmUP · This is an automated notification</p>
</div>`;
}

function buildNewMessageEmail(incidentId: string, site: any, messageText: string, senderEmail: string): string {
    const mapImg = site
        ? `<img src="${staticMapUrl(site.latitudine, site.longitude)}" width="600" style="border-radius:8px;display:block;margin:16px 0;" alt="Incident location"/>`
        : "";
    return `
<div style="background:#0f0a1e;font-family:sans-serif;padding:32px;max-width:640px;margin:auto;border-radius:12px;">
  <h2 style="color:#fff;margin-bottom:4px;">New message on your incident</h2>
  <p style="color:#6b7280;margin-top:0;">AlarmUP · Incident <strong style="color:#a78bfa;">INC${incidentId}</strong></p>

  <div style="background:#1a1030;border-left:3px solid #a78bfa;padding:14px 18px;border-radius:6px;margin:20px 0;">
    <p style="color:#94a3b8;font-size:12px;margin:0 0 6px;">From: ${senderEmail}</p>
    <p style="color:#e2e8f0;margin:0;">${messageText}</p>
  </div>

  ${site ? `<p style="color:#6b7280;font-size:13px;">Location: ${site.city ?? ""} ${site.address ?? ""}</p>` : ""}
  ${mapImg}

  <p style="color:#4b5563;font-size:12px;margin-top:24px;">AlarmUP · This is an automated notification</p>
</div>`;
}

type SignupEntry = { userId: string; otp: string; expiry: number };
const signupStore = new Map<string, SignupEntry>();

type MfaEntry = { code: string; expiry: number; session: any; attempts: number };
const mfaStore = new Map<string, MfaEntry>();

const MAX_LOGIN_ATTEMPTS = 3;
type LoginAttemptEntry = { attempts: number; lockedUntil: number };
const loginAttemptStore = new Map<string, LoginAttemptEntry>();

async function getUserByEmail(email: string) {
    const { data } = await supabase.auth.admin.listUsers();
    return data?.users?.find(u => u.email === email) ?? null;
}

async function lockAccountInDb(userId: string): Promise<void> {
    await supabase.from("profiles").update({ locked: true }).eq("id", userId);
}

app.use("/dashboard", requireAuth, createDashboardRouter(supabase));
app.use("/map", requireAuth, createMapRouter(supabase));
app.use("/statistics", requireAuth, createStatisticsRouter(supabase));


const runScript = () => {
  exec("py ../script_alarme/alarmeDB.py", { cwd: process.cwd() }, (error, stdout, stderr) => {
    if (error) { console.error("Script error:", error.message); return; }
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    
    exec("py ../script_alarme/incidente.py", { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) { console.error("Script error:", error.message); return; }
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
    });
  });
};


//
// cron.schedule("*/5 * * * *", runScript);
// runScript();
app.post("/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const attempt = loginAttemptStore.get(email);
    if (attempt && attempt.lockedUntil > Date.now()) {
        res.status(403).json({ message: "Account locked. Contact an administrator to unlock it." });
        return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
        const current = loginAttemptStore.get(email) ?? { attempts: 0, lockedUntil: 0 };
        const newAttempts = current.attempts + 1;
        if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
            loginAttemptStore.set(email, { attempts: newAttempts, lockedUntil: Number.MAX_SAFE_INTEGER });
            const user = await getUserByEmail(email);
            if (user) await lockAccountInDb(user.id);
            res.status(403).json({ message: "Account locked due to too many failed attempts. Contact an administrator." });
        } else {
            loginAttemptStore.set(email, { attempts: newAttempts, lockedUntil: 0 });
            res.status(401).json({ message: `Invalid email or password. ${MAX_LOGIN_ATTEMPTS - newAttempts} attempt(s) remaining.` });
        }
        return;
    }

    // Safety net: check DB lock even after a successful password (covers server restarts)
    const { data: profile } = await supabase
        .from("profiles")
        .select("locked")
        .eq("id", data.session.user.id)
        .single();

    if (profile?.locked) {
        loginAttemptStore.set(email, { attempts: MAX_LOGIN_ATTEMPTS, lockedUntil: Number.MAX_SAFE_INTEGER });
        res.status(403).json({ message: "Account locked. Contact an administrator to unlock it." });
        return;
    }

    loginAttemptStore.delete(email);

    const code = crypto.randomInt(100000, 1000000).toString();
    mfaStore.set(email, { code, expiry: Date.now() + 5 * 60 * 1000, session: data.session, attempts: 0 });

    try {
        await sendEmail(
            email,
            "AlarmUP Login Verification",
            `Your login verification code is: ${code}\n\nThis code expires in 5 minutes.`
        );
    } catch {
        res.status(500).json({ message: "Failed to send verification email." });
        return;
    }

    res.json({ mfaRequired: true });
});

app.post("/auth/verify-mfa", async (req: Request, res: Response) => {
    const { email, code } = req.body;

    const stored = mfaStore.get(email);
    if (!stored) {
        res.status(400).json({ message: "No pending login. Please log in again." });
        return;
    }
    if (Date.now() > stored.expiry) {
        mfaStore.delete(email);
        res.status(400).json({ message: "Code expired. Please log in again." });
        return;
    }
    if (stored.code !== code) {
        stored.attempts += 1;
        if (stored.attempts >= MAX_LOGIN_ATTEMPTS) {
            mfaStore.delete(email);
            res.status(400).json({ message: "Too many failed attempts. Please log in again." });
        } else {
            res.status(400).json({ message: `Invalid code. ${MAX_LOGIN_ATTEMPTS - stored.attempts} attempt(s) remaining.` });
        }
        return;
    }

    mfaStore.delete(email);

    const [profileResult, freshUserResult] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", stored.session.user.id).single(),
        supabase.auth.admin.getUserById(stored.session.user.id),
    ]);

    const role = profileResult.data?.role ?? "viewer";
    const mustChangePassword = freshUserResult.data?.user?.app_metadata?.must_change_password === true;

    res.json({
        token: stored.session.access_token,
        user: { id: stored.session.user.id, email: stored.session.user.email, role },
        mustChangePassword,
    });
});

app.post("/auth/signup", async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.admin.generateLink({
        type: "signup",
        email,
        password,
    });

    if (error) {
        res.status(400).json({ message: error.message });
        return;
    }

    const otp = data.properties.email_otp;
    signupStore.set(email, { userId: data.user.id, otp, expiry: Date.now() + 5 * 60 * 1000 });

    try {
        await sendEmail(
            email,
            "Verify your AlarmUP account",
            `Your verification code is: ${otp}\n\nEnter this code to confirm your account. It expires in 5 minutes.`
        );
    } catch {
        res.status(500).json({ message: "Failed to send verification email." });
        return;
    }

    res.status(201).json({ message: "Verification code sent to your email." });
});

app.post("/auth/verify-email", async (req: Request, res: Response) => {
    const { email, otp } = req.body;

    const stored = signupStore.get(email);
    if (!stored) {
        res.status(400).json({ message: "No pending verification. Please sign up again." });
        return;
    }
    if (Date.now() > stored.expiry) {
        signupStore.delete(email);
        res.status(400).json({ message: "Code expired. Please sign up again." });
        return;
    }
    if (stored.otp !== otp) {
        res.status(400).json({ message: "Invalid code." });
        return;
    }

    signupStore.delete(email);

    const { error } = await supabase.auth.admin.updateUserById(stored.userId, { email_confirm: true });
    if (error) {
        res.status(500).json({ message: "Failed to confirm account." });
        return;
    }

    res.json({ message: "Email verified. You can now log in." });
});

// GET toate site-urile
app.get("/sites", requireAuth, async (req: Request, res: Response) => {
    const { data, error } = await supabase
        .from("site")
        .select("id, latitudine, longitude, city, address")

    if (error) {
        res.status(500).json({ message: error.message })
        return
    }

    res.json(data)
})


// GET toate alarmele
app.get("/alarms", requireAuth, async (req: Request, res: Response) => {
    const { data, error } = await supabase
        .from("alarms")
        .select(`
            alarm_id,
            status,
            start_time,
            resolved_time,
            tehnologie,
            type:alarm_types(reason),
            site:site(city, address)
        `)
        .is("resolved_time", null)

    if (error) {
        res.status(500).json({ message: error.message })
        return
    }

    res.json(data)
})



// GET toate incidentele
app.get("/incidents", requireAuth, async (req: Request, res: Response) => {
    const { status } = req.query;
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        res.status(401).json({ message: "No token provided" });
        return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
        res.status(401).json({ message: "Invalid token" });
        return;
    }

    const { data: roleData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single();

    const isAdmin = roleData?.role === "admin";

    let query = supabase
        .from("incidents")
        .select("incident_id, status, start_time, end_time, priority, assigned_to, messages")

    if (status !== undefined) {
        query = query.eq("status", Number(status));
    }

    // non-admin users only see their own incidents
    if (!isAdmin) {
        query = query.eq("assigned_to", userData.user.id);
    }

    const { data, error } = await query;

    if (error) {
        res.status(500).json({ message: error.message });
        return;
    }

    res.json(data);
});

//incidente active

app.patch("/incidents/:id/assign", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { assigned_to } = req.body;

    const { data, error } = await supabase
        .from("incidents")
        .update({ assigned_to })
        .eq("incident_id", id)
        .select()
        .single();

    if (error) {
        res.status(500).json({ message: error.message });
        return;
    }

    res.json(data);

    // fire-and-forget: send assignment notification email
    if (assigned_to) {
        (async () => {
            try {
                const { data: userAuth } = await supabase.auth.admin.getUserById(assigned_to);
                const userEmail = userAuth?.user?.email;
                if (!userEmail) return;

                const { incident, alarms, site } = await getIncidentEmailData(id as string);
                const html = buildAssignmentEmail(id as string, incident, alarms, site);
                await sendHtmlEmail(userEmail, `[AlarmUP] You've been assigned to INC${id}`, html);
            } catch (err) {
                console.error("Failed to send assignment email:", err);
            }
        })();
    }
});

app.get("/users", requireAuth, async (req: Request, res: Response) => {
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
        res.status(500).json({ message: error.message });
        return;
    }

    res.json(data.users.map(u => ({ id: u.id, email: u.email })));
});

app.post("/users/create-by-admin", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const { email, role } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({message: "Email invalid."});
        return;
    }

    // Generare parolă aleatorie (ESM-safe)
    const charset = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
    const plainPassword = Array.from(crypto.randomBytes(12))
        .map((b: number) => charset[b % charset.length])
        .join("");

    const {data, error} = await supabase.auth.admin.createUser({
        email,
        password: plainPassword,
        email_confirm: true,
    });

    if (error) {
        const status = error.message.toLowerCase().includes("already") ? 409 : 400;
        res.status(status).json({message: error.message});
        return;
    }
    if (role === "admin") {
        await supabase
            .from("profiles")
            .upsert({ id: data.user.id, role: "admin" });
    }


    const siteName = process.env.SITE_NAME || "AlarmUP";
    const siteUrl = process.env.SITE_URL || "https://example.com";

    try {
        await sendHtmlEmail(email, `Your ${siteName} account has been created`, `
<div style="background:#0f0a1e;font-family:sans-serif;padding:32px;max-width:480px;margin:auto;border-radius:12px;">
    <h2 style="color:#fff;margin-bottom:4px;">Welcome to ${siteName}!</h2>
    <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px;">
        An account has been created for you on
        <a href="${siteUrl}" style="color:#a78bfa;">${siteName}</a>.
        Use the credentials below to sign in.
    </p>
    <div style="background:#1a1030;border:1px solid #2d1f4e;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Username (email)</p>
        <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#e2e8f0;">${email}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Auto-generated password</p>
        <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:3px;color:#a78bfa;font-family:monospace;">${plainPassword}</p>
    </div>
    <p style="color:#f87171;font-size:12px;margin:0 0 24px;">
        Please change your password immediately after your first sign in.
    </p>
    <a href="${siteUrl}/login"
        style="display:inline-block;background:#a78bfa;color:#0f0a1e;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
        Sign in now →
    </a>
    <p style="margin:24px 0 0;font-size:11px;color:#4b5563;">AlarmUP · Account created by an administrator</p>
</div>`);
    } catch (emailErr) {
        console.error("Failed to send welcome email:", emailErr);
        res.status(201).json({ message: "Account created, but the email could not be sent." });
        return;
    }

    res.status(201).json({ message: "Account created and email sent successfully." });});

app.post("/users/change-password", requireAuth, async (req: Request, res: Response) => {
    const { oldPassword, newPassword } = req.body;
    const authUser = req.user!;

    if (!oldPassword || !newPassword) {
        res.status(400).json({ message: "All fields are required." });
        return;
    }

    if (newPassword.length < 8) {
        res.status(400).json({ message: "New password must be at least 8 characters." });
        return;
    }

    if (!/[A-Z]/.test(newPassword)) {
        res.status(400).json({ message: "Password must contain at least one uppercase letter." });
        return;
    }

    if (!/[0-9]/.test(newPassword)) {
        res.status(400).json({ message: "Password must contain at least one number." });
        return;
    }

    try {
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: authUser.email!,
            password: oldPassword,
        });

        if (signInError) {
            res.status(401).json({ message: "Current password is incorrect." });
            return;
        }

        const { error: updateError } = await supabase.auth.admin.updateUserById(
            authUser.id,
            { password: newPassword }
        );

        if (updateError) {
            res.status(400).json({ message: updateError.message });
            return;
        }

        res.status(200).json({ message: "Password changed successfully." });

    } catch (err: any) {
        console.error("[change-password]", err);
        res.status(500).json({ message: "Internal server error." });
    }
});


app.get("/users/:id", requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };

    const isAdmin = req.user!.role === "admin";
    const isSelf = req.user!.id === id;

    if (!isAdmin && !isSelf) {
        res.status(404).json({ message: "User not found" });
        return;
    }

    const { data, error } = await supabase.auth.admin.getUserById(id);

    if (error || !data.user) {
        res.status(404).json({ message: "User not found" });
        return;
    }

    res.json({
        id: data.user.id,
        email: data.user.email,
    });
});


app.patch("/incidents/:id/message", requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { message } = req.body;
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        res.status(401).json({ message: "No token provided" });
        return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
        res.status(401).json({ message: "Invalid token" });
        return;
    }

    const { data: roleData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single();

    if (roleData?.role !== "admin") {
        res.status(403).json({ message: "Only admins can edit messages" });
        return;
    }

    const now = new Date().toISOString();

    const { error: insertError } = await supabase
        .from("messages")
        .insert({ id_incident: parseInt(id as string), id_user: userData.user.id, time: now, message });

    if (insertError) {
        res.status(500).json({ message: insertError.message });
        return;
    }

    const { data, error } = await supabase
        .from("incidents")
        .update({ messages: message })
        .eq("incident_id", id)
        .select()
        .single();

    if (error) {
        res.status(500).json({ message: error.message });
        return;
    }

    res.json(data);

    // fire-and-forget: notify assigned user about new message
    (async () => {
        try {
            const assignedTo = data?.assigned_to;
            if (!assignedTo || assignedTo === userData.user.id) return;

            const { data: assigneeAuth } = await supabase.auth.admin.getUserById(assignedTo);
            const assigneeEmail = assigneeAuth?.user?.email;
            if (!assigneeEmail) return;

            const { site } = await getIncidentEmailData(id as string);
            const senderEmail = userData.user.email ?? "an admin";
            const html = buildNewMessageEmail(id as string, site, message, senderEmail);
            await sendHtmlEmail(assigneeEmail, `[AlarmUP] New message on INC${id}`, html);
        } catch (err) {
            console.error("Failed to send message notification email:", err);
        }
    })();
});

app.get("/incidents/:id/messages", requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;

    const { data, error } = await supabase
        .from("messages")
        .select("id_messaje, id_user, time, message")
        .eq("id_incident", parseInt(id as string))
        .order("time", { ascending: false })
        .limit(3);

    if (error) {
        res.status(500).json({ message: error.message });
        return;
    }

    res.json(data ?? []);
});

app.post("/incidents/:id/send-report", requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { recipient_id, recipient_email } = req.body;

    if (!recipient_id && !recipient_email) {
        res.status(400).json({ message: "recipient_id or recipient_email is required" });
        return;
    }

    let recipientEmail: string;
    if (recipient_email) {
        recipientEmail = recipient_email;
    } else {
        const { data: recipientAuth, error: recipientError } = await supabase.auth.admin.getUserById(recipient_id);
        if (recipientError || !recipientAuth?.user?.email) {
            res.status(404).json({ message: "Recipient not found" });
            return;
        }
        recipientEmail = recipientAuth.user.email;
    }

    const { incident, alarms, site } = await getIncidentEmailData(id as string);

    const { data: messages } = await supabase
        .from("messages")
        .select("id_messaje, id_user, time, message")
        .eq("id_incident", parseInt(id as string))
        .order("time", { ascending: true });

    let assignedEmail = "Unassigned";
    if (incident?.assigned_to) {
        const { data: assignedAuth } = await supabase.auth.admin.getUserById(incident.assigned_to);
        assignedEmail = assignedAuth?.user?.email ?? incident.assigned_to;
    }

    const messageRows = messages?.length
        ? messages.map(m => `
            <tr>
                <td style="padding:8px 10px;color:#94a3b8;font-size:12px;white-space:nowrap;">${new Date(m.time).toLocaleString()}</td>
                <td style="padding:8px 10px;color:#a78bfa;font-size:12px;">${m.id_user}</td>
                <td style="padding:8px 10px;color:#e2e8f0;font-size:13px;">${m.message}</td>
            </tr>`).join("")
        : `<tr><td colspan="3" style="padding:10px;color:#4b5563;font-size:12px;">No messages</td></tr>`;

    const alarmRows = alarms.map(a =>
        `<tr><td style="padding:6px 10px;color:#94a3b8;">${a.tehnologie} · ${a.type}</td><td style="padding:6px 10px;color:#94a3b8;">${a.site}</td><td style="padding:6px 10px;color:${a.status === 1 ? "#f87171" : "#4ade80"};">${a.status === 1 ? "Active" : "Resolved"}</td></tr>`
    ).join("");

    const mapImg = site
        ? `<img src="${staticMapUrl(site.latitudine, site.longitude)}" width="600" style="border-radius:8px;display:block;margin:16px 0;" alt="Incident location"/>`
        : "";

    const html = `
<div style="background:#0f0a1e;font-family:sans-serif;padding:32px;max-width:640px;margin:auto;border-radius:12px;">
  <h2 style="color:#fff;margin-bottom:4px;">Incident Report</h2>
  <p style="color:#6b7280;margin-top:0;">AlarmUP · Incident <strong style="color:#a78bfa;">INC${id}</strong></p>

  <table style="width:100%;border-collapse:collapse;margin:20px 0;">
    <tr><td style="color:#6b7280;padding:6px 0;width:130px;">Priority</td><td style="color:#fff;">${incident?.priority ?? "—"}</td></tr>
    <tr><td style="color:#6b7280;padding:6px 0;">Status</td><td style="color:${incident?.status === 1 ? "#f87171" : "#4ade80"};">${incident?.status === 1 ? "Active" : "Resolved"}</td></tr>
    <tr><td style="color:#6b7280;padding:6px 0;">Start time</td><td style="color:#fff;">${incident?.start_time ? new Date(incident.start_time).toLocaleString() : "—"}</td></tr>
    <tr><td style="color:#6b7280;padding:6px 0;">End time</td><td style="color:#fff;">${incident?.end_time ? new Date(incident.end_time).toLocaleString() : "—"}</td></tr>
    <tr><td style="color:#6b7280;padding:6px 0;">Assigned to</td><td style="color:#fff;">${assignedEmail}</td></tr>
    <tr><td style="color:#6b7280;padding:6px 0;">Location</td><td style="color:#fff;">${site ? `${site.city ?? ""} — ${site.address ?? ""}` : "—"}</td></tr>
  </table>

  ${mapImg}

  ${alarms.length ? `
  <h3 style="color:#fff;margin-bottom:8px;">Related Alarms (${alarms.length})</h3>
  <table style="width:100%;border-collapse:collapse;background:#1a1030;border-radius:8px;overflow:hidden;margin-bottom:24px;">
    <thead><tr style="background:#2d1f4e;">
      <th style="padding:8px 10px;color:#a78bfa;text-align:left;font-size:12px;">Technology</th>
      <th style="padding:8px 10px;color:#a78bfa;text-align:left;font-size:12px;">Site</th>
      <th style="padding:8px 10px;color:#a78bfa;text-align:left;font-size:12px;">Status</th>
    </tr></thead>
    <tbody>${alarmRows}</tbody>
  </table>` : ""}

  <h3 style="color:#fff;margin-bottom:8px;">Messages</h3>
  <table style="width:100%;border-collapse:collapse;background:#1a1030;border-radius:8px;overflow:hidden;">
    <thead><tr style="background:#2d1f4e;">
      <th style="padding:8px 10px;color:#a78bfa;text-align:left;font-size:12px;">Time</th>
      <th style="padding:8px 10px;color:#a78bfa;text-align:left;font-size:12px;">User</th>
      <th style="padding:8px 10px;color:#a78bfa;text-align:left;font-size:12px;">Message</th>
    </tr></thead>
    <tbody>${messageRows}</tbody>
  </table>

  <p style="color:#4b5563;font-size:12px;margin-top:24px;">AlarmUP · This is an automated report</p>
</div>`;

    try {
        await sendHtmlEmail(recipientEmail, `[AlarmUP] Incident Report — INC${id}`, html);
        res.json({ message: "Report sent" });
    } catch (err) {
        res.status(500).json({ message: "Failed to send email" });
    }
});

app.patch("/incidents/:id/resolve", requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { end_time, message } = req.body;

    if (!end_time || !message?.trim()) {
        res.status(400).json({ message: "end_time and message are required" });
        return;
    }

    const { data: current, error: fetchError } = await supabase
        .from("incidents")
        .select("end_time, status, assigned_to")
        .eq("incident_id", id)
        .single();

    if (fetchError || !current) {
        res.status(404).json({ message: "Incident not found" });
        return;
    }

    if (current.end_time || current.status === 0) {
        res.status(409).json({ message: "Incident is already resolved" });
        return;
    }

    const isAdmin = req.user!.role === "admin";
    const isAssigned = current.assigned_to === req.user!.id;
    if (!isAdmin && !isAssigned) {
        res.status(403).json({ message: "Only the assigned user or an admin can resolve this incident" });
        return;
    }

    const { data, error } = await supabase
        .from("incidents")
        .update({ end_time, status: 0 })
        .eq("incident_id", id)
        .select()
        .single();

    if (error) {
        res.status(500).json({ message: error.message });
        return;
    }

    await supabase
        .from("messages")
        .insert({ id_incident: parseInt(id as string), id_user: req.user!.id, time: new Date().toISOString(), message: message.trim() });

    // Resolve all alarms linked to this incident
    const { data: linkedAlarms } = await supabase
        .from("incident_alarms")
        .select("alarm_id")
        .eq("incident_id", id);

    const alarmIds = linkedAlarms?.map((r: any) => r.alarm_id) ?? [];
    if (alarmIds.length > 0) {
        await supabase
            .from("alarms")
            .update({ status: 0 })
            .in("alarm_id", alarmIds);
    }

    res.json(data);
});

app.get("/incidents/:id", requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;

    const { data: incident, error } = await supabase
        .from("incidents")
        .select("incident_id, status, start_time, end_time, priority, assigned_to, messages")
        .eq("incident_id", id)
        .single();

    if (error) {
        res.status(404).json({ message: "Incident not found" });
        return;
    }

    const { data: incidentAlarms } = await supabase
        .from("incident_alarms")
        .select("alarm_id")
        .eq("incident_id", id);

    const alarmIds = incidentAlarms?.map((ia: any) => ia.alarm_id) ?? [];

    const { data: alarms } = await supabase
        .from("alarms")
        .select("alarm_id, site, tehnologie, type, status")
        .in("alarm_id", alarmIds);

    res.json({ ...incident, alarms: alarms ?? [] });
});

// ── Admin Request endpoints ──────────────────────────────────────────────────

app.post("/admin-requests", requireAuth, async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const { data: existing } = await supabase
        .from("admin_requests")
        .select("id_request, status")
        .eq("user_id", userId)
        .eq("status", "pending")
        .maybeSingle();

    if (existing) {
        res.status(409).json({ message: "pending" });
        return;
    }

    // Resolve admin emails before touching the DB
    let adminEmails: string[] = [];
    try {
        const { data: adminProfiles } = await supabase
            .from("profiles")
            .select("id")
            .eq("role", "admin");

        const { data: allUsers } = await supabase.auth.admin.listUsers();
        const adminIds = new Set(adminProfiles?.map((p: any) => p.id) ?? []);
        adminEmails = (allUsers?.users ?? [])
            .filter(u => adminIds.has(u.id))
            .map(u => u.email)
            .filter(Boolean) as string[];

        // Fallback: if no admins exist yet, notify the system mailbox
        if (adminEmails.length === 0 && process.env.SMTP_USER) {
            adminEmails = [process.env.SMTP_USER];
        }
    } catch {
        res.status(500).json({ message: "Something went wrong. Please try again later." });
        return;
    }

    const { data: requesterAuth } = await supabase.auth.admin.getUserById(userId);
    const requesterEmail = requesterAuth?.user?.email ?? userId;

    // Send email BEFORE inserting — keeps the operation atomic
    try {
        for (const email of adminEmails) {
            await sendHtmlEmail(email, "[AlarmUP] New admin access request", `
<div style="background:#0f0a1e;font-family:sans-serif;padding:32px;max-width:640px;margin:auto;border-radius:12px;">
  <h2 style="color:#fff;margin-bottom:4px;">New Admin Access Request</h2>
  <p style="color:#e2e8f0;margin-top:0;">A user has requested elevated admin access on AlarmUP.</p>
  <p style="color:#e2e8f0;"><strong style="color:#a78bfa;">From:</strong> ${requesterEmail}</p>
  <p style="color:#94a3b8;font-size:13px;margin-top:8px;">Admin privileges allow the user to manage incidents, assign responders, approve or reject access requests, and send reports.</p>
  <p style="color:#94a3b8;font-size:12px;margin-top:24px;">Log in to AlarmUP to approve or reject this request.</p>
</div>`);
        }
    } catch {
        res.status(500).json({ message: "Something went wrong. Please try again later." });
        return;
    }

    const { data, error } = await supabase
        .from("admin_requests")
        .insert({ user_id: userId })
        .select()
        .single();

    if (error) {
        res.status(500).json({ message: "Something went wrong. Please try again later." });
        return;
    }

    res.json(data);
});

app.get("/admin-requests/my", requireAuth, async (req: Request, res: Response) => {
    const { data, error } = await supabase
        .from("admin_requests")
        .select("id_request, status, created_at")
        .eq("user_id", req.user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        res.status(500).json({ message: error.message });
        return;
    }

    res.json(data ?? null);
});

app.get("/admin-requests", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const { data, error } = await supabase
        .from("admin_requests")
        .select("id_request, user_id, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

    if (error) {
        res.status(500).json({ message: error.message });
        return;
    }

    const { data: allUsers } = await supabase.auth.admin.listUsers();
    const userMap = new Map(allUsers?.users.map(u => [u.id, u.email]) ?? []);

    const enriched = (data ?? []).map((r: any) => ({
        id_request: r.id_request,
        user_id: r.user_id,
        status: r.status,
        created_at: r.created_at,
        email: userMap.get(r.user_id) ?? r.user_id,
    }));

    res.json(enriched);
});

app.patch("/admin-requests/:id/approve", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const idInt = parseInt(id as string);

    const { data: reqData, error: fetchError } = await supabase
        .from("admin_requests")
        .select("user_id")
        .eq("id_request", idInt)
        .single();

    if (fetchError || !reqData) {
        res.status(404).json({ message: "Request not found" });
        return;
    }

    await supabase.from("admin_requests").update({ status: "approved" }).eq("id_request", idInt);
    await supabase.from("profiles").update({ role: "admin" }).eq("id", reqData.user_id);

    res.json({ message: "Approved" });

    (async () => {
        try {
            const { data: userAuth } = await supabase.auth.admin.getUserById(reqData.user_id);
            const email = userAuth?.user?.email;
            if (!email) return;
            await sendHtmlEmail(email, "[AlarmUP] Your admin request was approved", `
<div style="background:#0f0a1e;font-family:sans-serif;padding:32px;max-width:640px;margin:auto;border-radius:12px;">
  <h2 style="color:#4ade80;margin-bottom:4px;">Request Approved</h2>
  <p style="color:#e2e8f0;">Your request for admin access on AlarmUP has been <strong style="color:#4ade80;">approved</strong>.</p>
  <p style="color:#e2e8f0;font-size:13px;">Log in again to activate your new permissions.</p>
  <p style="color:#94a3b8;font-size:12px;margin-top:24px;">AlarmUP · Automated notification</p>
</div>`);
        } catch (err) {
            console.error("Failed to send approval email:", err);
        }
    })();
});

app.patch("/admin-requests/:id/reject", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const idInt = parseInt(id as string);

    const { data: reqData, error: fetchError } = await supabase
        .from("admin_requests")
        .select("user_id")
        .eq("id_request", idInt)
        .single();

    if (fetchError || !reqData) {
        res.status(404).json({ message: "Request not found" });
        return;
    }

    await supabase.from("admin_requests").update({ status: "rejected" }).eq("id_request", idInt);

    res.json({ message: "Rejected" });

    (async () => {
        try {
            const { data: userAuth } = await supabase.auth.admin.getUserById(reqData.user_id);
            const email = userAuth?.user?.email;
            if (!email) return;
            await sendHtmlEmail(email, "[AlarmUP] Your admin request was rejected", `
<div style="background:#0f0a1e;font-family:sans-serif;padding:32px;max-width:640px;margin:auto;border-radius:12px;">
  <h2 style="color:#f87171;margin-bottom:4px;">Request Rejected</h2>
  <p style="color:#e2e8f0;">Your request for admin access on AlarmUP has been <strong style="color:#f87171;">rejected</strong>.</p>
  <p style="color:#94a3b8;font-size:12px;margin-top:24px;">AlarmUP · Automated notification</p>
</div>`);
        } catch (err) {
            console.error("Failed to send rejection email:", err);
        }
    })();
});

// ── Locked account management ────────────────────────────────────────────────

app.get("/admin/locked-users", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    const { data: lockedProfiles, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("locked", true);

    if (error) {
        res.status(500).json({ message: error.message });
        return;
    }

    if (!lockedProfiles || lockedProfiles.length === 0) {
        res.json([]);
        return;
    }

    const { data: allUsers } = await supabase.auth.admin.listUsers();
    const lockedIds = new Set(lockedProfiles.map((p: any) => p.id));
    const lockedUsers = (allUsers?.users ?? [])
        .filter(u => lockedIds.has(u.id))
        .map(u => ({ id: u.id, email: u.email }));

    res.json(lockedUsers);
});

app.patch("/admin/users/:id/unlock", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const { data: userAuth, error: userError } = await supabase.auth.admin.getUserById(id);
    if (userError || !userAuth?.user?.email) {
        res.status(404).json({ message: "User not found" });
        return;
    }

    const userEmail = userAuth.user.email;

    const charset = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
    const tempPassword = Array.from(crypto.randomBytes(12))
        .map((b: number) => charset[b % charset.length])
        .join("");

    const { error: updateError } = await supabase.auth.admin.updateUserById(id, {
        password: tempPassword,
        app_metadata: { must_change_password: true },
    });

    if (updateError) {
        res.status(500).json({ message: updateError.message });
        return;
    }

    await supabase.from("profiles").update({ locked: false }).eq("id", id);
    loginAttemptStore.delete(userEmail);

    try {
        await sendEmail(
            userEmail,
            "AlarmUP — Account Unlocked",
            `Your account has been unlocked by an administrator.\n\nYou can now log in with the temporary password below:\n\nTemporary password: ${tempPassword}\n\nYou will be required to set a new password immediately after logging in. This temporary password cannot be reused.\n\nIf you did not expect this email, contact your administrator.`
        );
    } catch (emailErr) {
        console.error("Failed to send unlock email:", emailErr);
    }

    res.json({ message: "Account unlocked. Temporary password sent to user." });
});

app.post("/auth/change-password", requireAuth, async (req: Request, res: Response) => {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
        res.status(400).json({ message: "Password must be at least 8 characters." });
        return;
    }

    const { error } = await supabase.auth.admin.updateUserById(req.user!.id, {
        password: newPassword,
        app_metadata: { must_change_password: false },
    });

    if (error) {
        res.status(500).json({ message: error.message });
        return;
    }

    res.json({ message: "Password changed successfully." });
});

app.listen(3000, () => console.log("Backend running on http://localhost:3000"))