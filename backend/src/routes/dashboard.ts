import { Router, Request, Response } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "./statistics/helpers";

const createDashboardRouter = (supabase: SupabaseClient) => {
    const router = Router();

    router.get("/alarms/chart", async (req: Request, res: Response) => {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await fetchAll<{ start_time: string }>((from, to) =>
            supabase
                .from("alarms")
                .select("start_time")
                .gte("start_time", since)
                .order("alarm_id", { ascending: true })
                .range(from, to)
        );

        if (error || !data) {
            console.error(error);
            res.status(500).json({ message: "Something went wrong." });
            return;
        }

        const grouped: Record<string, number> = {};
        data.forEach((alarm: any) => {
            const date = new Date(alarm.start_time).toLocaleDateString("ro-RO", {
                day: "2-digit",
                month: "2-digit",
            });
            grouped[date] = (grouped[date] || 0) + 1;
        });

        const result = Object.entries(grouped)
            .map(([date, value]) => ({ date, value }))
            .sort((a, b) => {
                const [dayA, monthA] = a.date.split(".").map(Number);
                const [dayB, monthB] = b.date.split(".").map(Number);
                if (monthA !== monthB) return monthA - monthB;
                return dayA - dayB;
            });

        res.json(result);
    });

    router.get("/incidents/chart", async (req: Request, res: Response) => {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await fetchAll<{ start_time: string }>((from, to) =>
            supabase
                .from("incidents")
                .select("start_time")
                .gte("start_time", since)
                .order("incident_id", { ascending: true })
                .range(from, to)
        );

        if (error || !data) {
            console.error(error);
            res.status(500).json({ message: "Something went wrong." });
            return;
        }

        const grouped: Record<string, number> = {};
        data.forEach((incident: any) => {
            const date = new Date(incident.start_time).toLocaleDateString("ro-RO", {
                day: "2-digit",
                month: "2-digit",
            });
            grouped[date] = (grouped[date] || 0) + 1;
        });

        const result = Object.entries(grouped)
            .map(([date, value]) => ({ date, value }))
            .sort((a, b) => {
                const [dayA, monthA] = a.date.split(".").map(Number);
                const [dayB, monthB] = b.date.split(".").map(Number);
                if (monthA !== monthB) return monthA - monthB;
                return dayA - dayB;
            });

        res.json(result);
    });
    router.get("/stats", async (req: Request, res: Response) => {
        const { count: total } = await supabase
            .from("alarms")
            .select("*", { count: "exact", head: true });

        const { count: resolved } = await supabase
            .from("alarms")
            .select("*", { count: "exact", head: true })
            .eq("status", 0);

        const { count: active } = await supabase
            .from("alarms")
            .select("*", { count: "exact", head: true })
            .eq("status", 1);

        const { count: totalIncidents } = await supabase
            .from("incidents")
            .select("*", { count: "exact", head: true });

        const { count: criticalCount } = await supabase
            .from("incidents")
            .select("*", { count: "exact", head: true })
            .eq("priority", "Critical");

        const resolvedIncidentsResult = await fetchAll((from, to) =>
            supabase
                .from("incidents")
                .select("start_time, end_time")
                .eq("status", 0)
                .not("end_time", "is", null)
                .range(from, to)
        );

        if (resolvedIncidentsResult.error || !resolvedIncidentsResult.data) {
            console.error(resolvedIncidentsResult.error);
            res.status(500).json({ message: "Something went wrong." });
            return;
        }

        const resolvedIncidents = resolvedIncidentsResult.data;

        const resolutionRate =
            total && total > 0
                ? (((resolved ?? 0) / total) * 100).toFixed(1)
                : "0.0";

        const avgResolveMs =
            resolvedIncidents.length > 0
                ? resolvedIncidents.reduce((sum: number, i: any) => {
                    return (
                        sum +
                        (new Date(i.end_time).getTime() -
                            new Date(i.start_time).getTime())
                    );
                }, 0) / resolvedIncidents.length
                : 0;

        const avgResolveHours = Math.floor(avgResolveMs / (1000 * 60 * 60));
        const avgResolveMinutes = Math.floor(
            (avgResolveMs % (1000 * 60 * 60)) / (1000 * 60)
        );

        const avgResolveTime =
            resolvedIncidents.length > 0
                ? `${avgResolveHours}h ${avgResolveMinutes}m`
                : "N/A";

        res.json({
            total: total ?? 0,
            resolved: resolved ?? 0,
            active: active ?? 0,
            resolutionRate,
            avgResolveTime,
            totalIncidents: totalIncidents ?? 0,
            criticalCount: criticalCount ?? 0
        });
    });


    return router;
}

export default createDashboardRouter;