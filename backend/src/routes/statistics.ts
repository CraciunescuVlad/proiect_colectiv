import { Router, Request, Response } from "express";
import { SupabaseClient } from "@supabase/supabase-js";

const createStatisticsRouter = (supabase: SupabaseClient) => {
    const router = Router();

    router.get("/test", (req: Request, res: Response) => {
        res.json({ message: "statistics router works" })
    })

    return router;
}

export default createStatisticsRouter;