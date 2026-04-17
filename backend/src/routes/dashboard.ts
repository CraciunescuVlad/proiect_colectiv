import { Router, Request, Response } from "express";
import { SupabaseClient } from "@supabase/supabase-js";

const createDashboardRouter = (supabase: SupabaseClient) => {
    const router = Router();

    router.get("/test", (req: Request, res: Response) => {
        res.json({ message: "dashboard router works" })
    })

    router.get("/alarms/chart", async (req: Request, res: Response) => {
        const { data, error } = await supabase
            .from("alarms")
            .select("start_time")
            .gte("start_time", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

        if (error) {
            res.status(500).json({ message: error.message })
            return
        }

        const grouped: Record<string, number> = {}
        data.forEach((alarm: any) => {
            const date = new Date(alarm.start_time).toLocaleDateString("ro-RO", {
                day: "2-digit",
                month: "2-digit",
            })
            grouped[date] = (grouped[date] || 0) + 1
        })

        const result = Object.entries(grouped)
            .map(([date, value]) => ({ date, value }))
            .sort((a, b) => {
                const [dayA, monthA] = a.date.split(".").map(Number);
                const [dayB, monthB] = b.date.split(".").map(Number);
                if (monthA !== monthB) return monthA - monthB;
                return dayA - dayB;
            })

        res.json(result)
    })

    router.get("/incidents/chart", async (req: Request, res: Response) => {
        const { data, error } = await supabase
            .from("incidents")
            .select("start_time")
            .gte("start_time", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

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

        const result = Object.entries(grouped)
            .map(([date, value]) => ({ date, value }))
            .sort((a, b) => {
                const [dayA, monthA] = a.date.split(".").map(Number);
                const [dayB, monthB] = b.date.split(".").map(Number);
                if (monthA !== monthB) return monthA - monthB;
                return dayA - dayB;
            })

        res.json(result)
    })

    router.get("/stats", async (req: Request, res: Response) => {
        const { data, error } = await supabase
            .from("alarms")
            .select("alarm_id, status, start_time, resolved_time")

        if (error) {
            res.status(500).json({ message: error.message })
            return
        }

        const total = data.length
        const resolved = data.filter((a: any) => a.status === 0).length
        const active = data.filter((a: any) => a.status === 1).length
        const resolutionRate = total > 0 ? ((resolved / total) * 100).toFixed(1) : "0.0"

        const resolvedAlarms = data.filter((a: any) => a.status === 0 && a.resolved_time && a.start_time)
        const avgResolveMs = resolvedAlarms.length > 0
            ? resolvedAlarms.reduce((sum: number, a: any) => {
            return sum + (new Date(a.resolved_time).getTime() - new Date(a.start_time).getTime())
        }, 0) / resolvedAlarms.length
            : 0

        const avgResolveHours = Math.floor(avgResolveMs / (1000 * 60 * 60))
        const avgResolveMinutes = Math.floor((avgResolveMs % (1000 * 60 * 60)) / (1000 * 60))
        const avgResolveTime = resolvedAlarms.length > 0 ? `${avgResolveHours}h ${avgResolveMinutes}m` : "N/A"

        res.json({ total, resolved, active, resolutionRate, avgResolveTime })
    })

    return router;
}

export default createDashboardRouter;