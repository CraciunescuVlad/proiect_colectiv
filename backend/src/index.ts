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
import createStatisticsRouter from "./routes/statistics";
import { requireAdmin, requireAuth } from "./middleware/auth";

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

type SignupEntry = { userId: string; otp: string; expiry: number };
const signupStore = new Map<string, SignupEntry>();

type MfaEntry = { code: string; expiry: number; session: any };
const mfaStore = new Map<string, MfaEntry>();

app.use("/dashboard", createDashboardRouter(supabase));
app.use("/map", createMapRouter(supabase));
app.use("/statistics", createStatisticsRouter(supabase));

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



//cron.schedule("*/5 * * * *", runScript);
//runScript();
app.post("/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    mfaStore.set(email, { code, expiry: Date.now() + 5 * 60 * 1000, session: data.session });

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
        res.status(400).json({ message: "Invalid code." });
        return;
    }

    mfaStore.delete(email);

    const { data: userData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", stored.session.user.id)
        .single();

    const role = userData?.role ?? "viewer";

    res.json({
        token: stored.session.access_token,
        user: { id: stored.session.user.id, email: stored.session.user.email, role },
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
        .select("alarm_id, status, start_time, resolved_time, type, tehnologie, site")

    if (error) {
        res.status(500).json({ message: error.message })
        return
    }

    res.json(data)
})



// GET toate incidentele
app.get("/incidents", requireAuth, async (req: Request, res: Response) => {
    const { status } = req.query;

    let query = supabase
        .from("incidents")
        .select("incident_id, status, start_time, end_time, priority, assigned_to, messages")

    if (status !== undefined) {
        query = query.eq("status", Number(status))
    }

    const { data, error } = await query;

    if (error) {
        res.status(500).json({ message: error.message })
        return
    }

    res.json(data)
})

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
});

app.get("/users", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
        res.status(500).json({ message: error.message });
        return;
    }

    res.json(data.users.map(u => ({ id: u.id, email: u.email })));
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
    const { messages } = req.body;
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

    const { data, error } = await supabase
        .from("incidents")
        .update({ messages })
        .eq("incident_id", id)
        .select()
        .single();

    if (error) {
        res.status(500).json({ message: error.message });
        return;
    }

    res.json(data);
});

app.get("/incidents/:id", async (req: Request, res: Response) => {
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

app.listen(3000, () => console.log("Backend running on http://localhost:3000"))