import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import cron from "node-cron";
import { exec } from "child_process";
import createDashboardRouter from "./routes/dashboard";
import createMapRouter from "./routes/map";
import createStatisticsRouter from "./routes/statistics";

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

// Supabase client (service role — backend only)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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



cron.schedule("*/5 * * * *", runScript);
runScript();
app.post("/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error || !data.session) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
    }

    // Fetch role from your custom users table
    const { data: userData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

    const role = userData?.role ?? "viewer";

    res.json({
        token: data.session.access_token,
        user: {
            id: data.user.id,
            email: data.user.email,
            role,
        },
    });
});

app.post("/auth/signup", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    res.status(400).json({ message: error.message });
    return;
  }

  res.status(201).json({ message: "Account created successfully." });
});

// GET toate site-urile
app.get("/sites", async (req: Request, res: Response) => {
    const { data, error } = await supabase
        .from("site")
        .select("id, latitudine, longitude, city, address")

    if (error) {
        res.status(500).json({ message: error.message })
        return
    }

    res.json(data)
})

// // GET un site după id (ex: /sites/A001)
// app.get("/sites/:id", async (req: Request, res: Response) => {
//     const { id } = req.params
//
//     const { data, error } = await supabase
//         .from("site")
//         .select("id, latitudine, longitude, city, address")
//         .eq("id", id)
//         .single()
//
//     if (error) {
//         res.status(404).json({ message: "Site negăsit" })
//         return
//     }
//
//     res.json(data)
// })

// GET toate alarmele
app.get("/alarms", async (req: Request, res: Response) => {
    const { data, error } = await supabase
        .from("alarms")
        .select("alarm_id, status, start_time, resolved_time, type, tehnologie, site")

    if (error) {
        res.status(500).json({ message: error.message })
        return
    }

    res.json(data)
})

app.get("/standalone_alarms", async (req: Request, res: Response) => {
    try {
        // 1. Extrage ID-urile tuturor alarmelor care fac parte din incidente active
        const { data: incidentAlarms, error: iaError } = await supabase
            .from("incident_alarms")
            .select("alarm_id");

        if (iaError) throw iaError;

        // Creăm o listă cu ID-urile alarmelor ocupate
        const busyAlarmIds = incidentAlarms.map(ia => ia.alarm_id);

        // 2. Extrage alarmele active care NU sunt în lista de mai sus
        let query = supabase
            .from("alarms")
            .select("alarm_id, status, start_time, type, tehnologie, site")
            .eq("status", 1); // Doar alarme active

        // Dacă avem alarme în incidente, le excludem
        if (busyAlarmIds.length > 0) {
            query = query.not("alarm_id", "in", `(${busyAlarmIds.join(",")})`);
        }

        const { data: standaloneAlarms, error: alarmError } = await query;

        if (alarmError) throw alarmError;

        res.json(standaloneAlarms);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// GET toate incidentele
app.get("/incidents", async (req: Request, res: Response) => {
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
app.get("/active_incidents", async (req: Request, res: Response) => {
    const { data: incidents, error: incError } = await supabase
        .from("incidents")
        .select("incident_id, status, start_time, end_time, priority, assigned_to, messages")
        .eq("status", 1)

    if (incError) {
        res.status(500).json({ message: incError.message })
        return
    }
    if (!incidents || incidents.length === 0) {
        return res.json([]);
    }

    const incidentIds = incidents.map(i => i.incident_id);

    // Ia toate legaturile din incident_alarms
    const { data: incidentAlarms, error: iaError } = await supabase
        .from("incident_alarms")
        .select("incident_id, alarm_id")
        .in("incident_id", incidentIds)

    if (iaError) {
        res.status(500).json({ message: iaError.message })
        return
    }

    const alarmIds = incidentAlarms.map(ia => ia.alarm_id);

    // Ia toate alarmele asociate
    const { data: alarms, error: alarmError } = await supabase
        .from("alarms")
        .select("alarm_id, site, tehnologie, type, status")
        .in("alarm_id", alarmIds)

    if (alarmError) {
        res.status(500).json({ message: alarmError.message })
        return
    }

    // Combini: fiecare incident primeste array de alarme
    const result = incidents.map(i => ({
        ...i,
        alarms: incidentAlarms
            .filter(ia => ia.incident_id === i.incident_id)
            .map(ia => alarms.find(a => a.alarm_id === ia.alarm_id))
            .filter(Boolean)
    }));

    res.json(result)
})

app.patch("/incidents/:id/assign", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { assigned_to } = req.body;
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

    console.log("Role data:", roleData);

    if (roleData?.role !== "admin") {
        res.status(403).json({ message: "Only admins can assign incidents" });
        return;
    }

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

app.get("/users", async (req: Request, res: Response) => {
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
        res.status(403).json({ message: "Only admins can list users" });
        return;
    }

    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
        res.status(500).json({ message: error.message });
        return;
    }

    res.json(data.users.map(u => ({ id: u.id, email: u.email })));
});

app.get("/users/:id", async (req: Request, res: Response) => {
    const { id } = req.params;

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

app.patch("/incidents/:id/message", async (req: Request, res: Response) => {
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


app.listen(3000, () => console.log("Backend running on http://localhost:3000"))


