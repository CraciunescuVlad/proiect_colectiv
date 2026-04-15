import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";


dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

// Supabase client (service role — backend only)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

app.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Sign in with Supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  // Return Supabase's own token (no need to generate JWT manually anymore)
  res.json({
    token: data.session.access_token,
    user: {
      id: data.user.id,
      email: data.user.email,
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

  res.json({ message: "Signup successful! Please verify your email.", user: data.user });
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

// GET un site după id (ex: /sites/A001)
app.get("/sites/:id", async (req: Request, res: Response) => {
    const { id } = req.params

    const { data, error } = await supabase
        .from("site")
        .select("id, latitudine, longitude, city, address")
        .eq("id", id)
        .single()

    if (error) {
        res.status(404).json({ message: "Site negăsit" })
        return
    }

    res.json(data)
})

app.listen(3000, () => console.log("Backend running on http://localhost:3000"))


