import { Router, Request, Response } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "./helpers";
import { requireAuth, requireAdmin } from "../../middleware/auth";

/**
 * Builds the router for profile-related metadata endpoints.
 * All endpoints here are admin-only.
 *
 * @param supabase The Supabase client used by every endpoint
 * @return The configured Express router
 */
const createProfilesRouter = (supabase: SupabaseClient) => {
    const router = Router();

    /**
     * Returns the list of viewer profiles, sorted ascending by email.
     * Restricted to admins. Used to populate the profile filter dropdown in Statistics.
     */
    router.get("/profiles", requireAuth, requireAdmin, async (req: Request, res: Response) => {
        const { data, error } = await fetchAll<{ id: string; email: string }>((rangeFrom, rangeTo) =>
            supabase
                .from("profiles")
                .select("id, email")
                .eq("role", "viewer")
                .order("email", { ascending: true })
                .range(rangeFrom, rangeTo)
        );

        if (error || !data) {
            res.status(500).json({ message: error?.message ?? "No data" });
            return;
        }

        res.json(data);
    });

    return router;
};

export default createProfilesRouter;