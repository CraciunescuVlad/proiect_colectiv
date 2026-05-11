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
    router.get("/alarms/chart-by-severity", async (req: Request, res: Response) => {
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
            .from("alarms")
            .select("start_time, alarm_types(severity)")
            .gte("start_time", startDate.toISOString())
            .lte("start_time", endDate.toISOString())

        if (error) {
            res.status(500).json({ message: error.message })
            return
        }

        const severityLabel = (s: number): "Low" | "Medium" | "High" | null => {
            if (s === 1) return "Low";
            if (s === 2) return "Medium";
            if (s === 3) return "High";
            return null;
        };
        // Count incidents per (day, priority)
        const grouped: Record<string, Record<string, number>> = {}
        data.forEach((alarm: any) => {
            const date = new Date(alarm.start_time).toLocaleDateString("ro-RO", {
                day: "2-digit",
                month: "2-digit",
            })
            if (!grouped[date]) {
                grouped[date] = { Low: 0, Medium: 0, High: 0 };
            }
            const sev = alarm.alarm_types?.severity;
            const label = severityLabel(sev);
            if (label) {
                grouped[date][label] += 1;
            }
        })

        // Generate all days in the interval, filling missing ones with zeroes
        const result: { date: string; Low: number; Medium: number; High: number }[] = [];
        const cursor = new Date(startDate);
        cursor.setHours(0, 0, 0, 0);
        const lastDay = new Date(endDate);
        lastDay.setHours(0, 0, 0, 0);

        while (cursor <= lastDay) {
            const label = cursor.toLocaleDateString("ro-RO", {
                day: "2-digit",
                month: "2-digit",
            });
            const day = grouped[label] ?? { Low: 0, Medium: 0, High: 0 };
            result.push({ date: label, ...day });
            cursor.setDate(cursor.getDate() + 1);
        }

        res.json(result)
    })

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
                grouped[date] = { Warning: 0, Minor: 0, Major: 0, Critical: 0 };
            }
            const p = incident.priority;
            if (p === "Warning" || p === "Minor" || p === "Major" || p === "Critical") {
                grouped[date][p] += 1;
            }
        })

        // Generate all days in the interval, filling missing ones with zeroes
        const result: { date: string; Warning: number; Minor: number; Major: number; Critical: number }[] = [];
        const cursor = new Date(startDate);
        cursor.setHours(0, 0, 0, 0);
        const lastDay = new Date(endDate);
        lastDay.setHours(0, 0, 0, 0);

        while (cursor <= lastDay) {
            const label = cursor.toLocaleDateString("ro-RO", {
                day: "2-digit",
                month: "2-digit",
            });
            const day = grouped[label] ?? { Warning: 0, Minor: 0, Major: 0, Critical: 0 };
            result.push({
                date: label,
                Warning: day.Warning,
                Minor: day.Minor,
                Major: day.Major,
                Critical: day.Critical,
            });
            cursor.setDate(cursor.getDate() + 1);
        }

        res.json(result)
    })

    // Returns the average resolution time (in minutes) of incidents per day
    // Uses end_time as the grouping date (the day the incident was resolved)
    // Days without resolved incidents return 0
    router.get("/incidents/avg-resolution/chart", async (req: Request, res: Response) => {
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
            .select("start_time, end_time")
            .not("end_time", "is", null)
            .gte("end_time", startDate.toISOString())
            .lte("end_time", endDate.toISOString())

        if (error) {
            res.status(500).json({ message: error.message })
            return
        }

        // Sum durations and counts per day, so we can compute the average later
        const grouped: Record<string, { totalMinutes: number; count: number }> = {}
        data.forEach((incident: any) => {
            const start = new Date(incident.start_time).getTime();
            const end = new Date(incident.end_time).getTime();
            const durationMinutes = (end - start) / (1000 * 60);

            if (durationMinutes < 0)
                return;

            const date = new Date(incident.end_time).toLocaleDateString("ro-RO", {
                day: "2-digit",
                month: "2-digit",
            })
            if (!grouped[date]) {
                grouped[date] = { totalMinutes: 0, count: 0 };
            }
            grouped[date].totalMinutes += durationMinutes;
            grouped[date].count += 1;
        })

        // Generate all days in the interval, computing the average per day
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
            const day = grouped[label];
            let avg = 0;
            if (day && day.count > 0) {
                avg = Math.round(day.totalMinutes / day.count);
            }
            result.push({ date: label, value: avg });
            cursor.setDate(cursor.getDate() + 1);
        }

        res.json(result)
    })

    return router;
}

export default createStatisticsRouter;