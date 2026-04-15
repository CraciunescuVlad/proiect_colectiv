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

});

app.listen(3000, () => console.log("Backend running on http://localhost:3000"));