import { Request, Response, NextFunction } from "express";
import { supabase } from "../supabase";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email?: string; role?: string };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
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

    req.user = {
        id: userData.user.id,
        email: userData.user.email,
        role: roleData?.role,
    };

    next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (req.user?.role !== "admin") {
        res.status(403).json({ message: "Admin access required" });
        return;
    }
    next();
}