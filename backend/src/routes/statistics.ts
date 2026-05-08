import { Router, Request, Response } from "express";
import { SupabaseClient } from "@supabase/supabase-js";

const createStatisticsRouter = (supabase: SupabaseClient) => {
    const router = Router();

    router.get("/test", (req: Request, res: Response) => {
        res.json({ message: "statistics router works" })
    })

    // Returns the number of incidents per day in a given date range
    // Defaults to the last 30 days if 'from' and 'to' are not provided
    router.get("/incidents/chart", async (req: Request, res: Response) => {
        const { from, to } = req.query;

        let startDate: Date;
        let endDate: Date;

        if (from && to && typeof from === "string" && typeof to === "string") {
            startDate = new Date(from);
            endDate = new Date(to);
            endDate.setUTCHours(23, 59, 59, 999);
        } else {
            endDate = new Date();
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        }

        const { data, error } = await supabase
            .from("incidents")
            .select("start_time")
            .gte("start_time", startDate.toISOString())
            .lte("start_time", endDate.toISOString())

        if (error) {
            res.status(500).json({ message: error.message })
            return
        }

        const grouped: Record<string, number> = {}
        data.forEach((incident: any) => {
            const date = new Date(incident.start_time).toLocaleDateString("ro-RO", {
                day: "2-digit",
                month: "2-digit",
            })
            grouped[date] = (grouped[date] || 0) + 1
        })

        // Generate all days in the interval, filling missing ones with 0
        const result: { date: string; value: number }[] = [];
        const cursor = new Date(startDate);
        cursor.setHours(0, 0, 0, 0);
        const lastDay = new Date(endDate);
        lastDay.setHours(0, 0, 0, 0);

        while (cursor <= lastDay) {
            const label = cursor.toLocaleDateString("ro-RO", {
                day: "2-digit",
                month: "2-digit",
            });
            result.push({ date: label, value: grouped[label] || 0 });
            cursor.setDate(cursor.getDate() + 1);
        }

        res.json(result)
    })

    router.get("/alarms/chart", async (req: Request, res: Response) => {
        const { from, to } = req.query;

        let startDate: Date;
        let endDate: Date;

        if (from && to && typeof from === "string" && typeof to === "string") {
            startDate = new Date(from);
            endDate = new Date(to);
            endDate.setUTCHours(23, 59, 59, 999);
        } else {
            endDate = new Date();
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        }

        const { data, error } = await supabase
            .from("alarms")
            .select("start_time")
            .gte("start_time", startDate.toISOString())
            .lte("start_time", endDate.toISOString())

        if (error) {
            res.status(500).json({ message: error.message })
            return
        }

        const grouped: Record<string, number> = {}
        data.forEach((incident: any) => {
            const date = new Date(incident.start_time).toLocaleDateString("ro-RO", {
                day: "2-digit",
                month: "2-digit",
            })
            grouped[date] = (grouped[date] || 0) + 1
        })

        // Generate all days in the interval, filling missing ones with 0
        const result: { date: string; value: number }[] = [];
        const cursor = new Date(startDate);
        cursor.setHours(0, 0, 0, 0);
        const lastDay = new Date(endDate);
        lastDay.setHours(0, 0, 0, 0);

        while (cursor <= lastDay) {
            const label = cursor.toLocaleDateString("ro-RO", {
                day: "2-digit",
                month: "2-digit",
            });
            result.push({ date: label, value: grouped[label] || 0 });
            cursor.setDate(cursor.getDate() + 1);
        }

        res.json(result)
    })

    // Returns the number of incidents per day, split by priority
// Each day contains keys: warning, minor, major, critical
router.get("/incidents/chart-by-priority", async (req: Request, res: Response) => {
    const { from, to } = req.query;

    let startDate: Date;
    let endDate: Date;

    if (from && to && typeof from === "string" && typeof to === "string") {
        startDate = new Date(`${from}T00:00:00`);
        endDate = new Date(`${to}T23:59:59.999`);
    } else {
        endDate = new Date();
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const { data, error } = await supabase
        .from("incidents")
        .select("start_time, priority")
        .gte("start_time", startDate.toISOString())
        .lte("start_time", endDate.toISOString())

    if (error) {
        res.status(500).json({ message: error.message })
        return
    }

    // Count incidents per (day, priority)
    const grouped: Record<string, Record<string, number>> = {}
    data.forEach((incident: any) => {
        const date = new Date(incident.start_time).toLocaleDateString("ro-RO", {
            day: "2-digit",
            month: "2-digit",
        })
        if (!grouped[date]) {
            grouped[date] = { warning: 0, minor: 0, major: 0, critical: 0 };
        }
        const p = incident.priority;
        if (p === "warning" || p === "minor" || p === "major" || p === "critical") {
            grouped[date][p] += 1;
        }
    })

    // Generate all days in the interval, filling missing ones with zeroes
    const result: { date: string; warning: number; minor: number; major: number; critical: number }[] = [];
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);
    const lastDay = new Date(endDate);
    lastDay.setHours(0, 0, 0, 0);

    while (cursor <= lastDay) {
        const label = cursor.toLocaleDateString("ro-RO", {
            day: "2-digit",
            month: "2-digit",
        });
        const day = grouped[label] ?? { warning: 0, minor: 0, major: 0, critical: 0 };
        result.push({ date: label, ...day });
        cursor.setDate(cursor.getDate() + 1);
    }

    res.json(result)
})
    
    return router;
}

export default createStatisticsRouter;