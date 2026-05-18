import { Router, Request, Response } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import createSitesRouter from "./sites";
import createProfilesRouter from "./profiles";
import createIncidentsRouter from "./incidents";
import createAlarmsRouter from "./alarms";

/**
 * Builds the Express router exposing all statistics endpoints.
 * Mounts sub-routers grouped by domain (sites, profiles, incidents, alarms).
 *
 * @param supabase The Supabase client used by every endpoint
 * @return The configured Express router
 */
const createStatisticsRouter = (supabase: SupabaseClient) => {
    const router = Router();

    /**
     * Health-check endpoint used to verify that the router is mounted.
     */
    router.get("/test", (req: Request, res: Response) => {
        res.json({ message: "statistics router works" });
    });

    router.use(createSitesRouter(supabase));
    router.use(createProfilesRouter(supabase));
    router.use(createIncidentsRouter(supabase));
    router.use(createAlarmsRouter(supabase));

    return router;
};

export default createStatisticsRouter;