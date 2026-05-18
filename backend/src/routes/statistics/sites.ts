import { Router, Request, Response } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "./helpers";

/**
 * Builds the router for site-related metadata endpoints.
 *
 * @param supabase The Supabase client used by every endpoint
 * @return The configured Express router
 */
const createSitesRouter = (supabase: SupabaseClient) => {
    const router = Router();

    /**
     * Returns the list of site IDs, sorted ascending.
     * The 'id' column is aliased as 'site_id' so the frontend receives the expected shape.
     */
    router.get("/sites", async (req: Request, res: Response) => {
        const { data, error } = await fetchAll<{ id: string }>((rangeFrom, rangeTo) =>
            supabase
                .from("site")
                .select("id")
                .order("id", { ascending: true })
                .range(rangeFrom, rangeTo)
        );

        if (error || !data) {
            res.status(500).json({ message: error?.message ?? "No data" });
            return;
        }

        const result = data.map(row => ({ site_id: row.id }));
        res.json(result);
    });

    return router;
};

export default createSitesRouter;