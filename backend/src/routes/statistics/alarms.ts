import { Router, Request, Response } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import {
    fetchAll,
    parseSiteIds,
    parseDateRange,
    parseGranularity,
    bucketLabel,
    forEachBucket,
} from "./helpers";

/**
 * Builds the router for alarm-related statistics endpoints.
 *
 * @param supabase The Supabase client used by every endpoint
 * @return The configured Express router
 */
const createAlarmsRouter = (supabase: SupabaseClient) => {
    const router = Router();

    /**
     * Returns the number of alarms per bucket in the requested date range.
     * Bucket size is controlled by the optional 'granularity' query param (day, week, month).
     * When 'siteId' is provided (single value or comma-separated list), only alarms on those sites are counted.
     * Empty buckets are filled with zero so the chart shows a continuous timeline.
     */
    router.get("/alarms/chart", async (req: Request, res: Response) => {
        const siteIds = parseSiteIds(req.query.siteId);
        const { startDate, endDate } = parseDateRange(req.query.from, req.query.to);
        const granularity = parseGranularity(req.query.granularity);

        const { data, error } = await fetchAll<{ start_time: string }>((rangeFrom, rangeTo) => {
            let q = supabase
                .from("alarms")
                .select("start_time")
                .gte("start_time", startDate.toISOString())
                .lte("start_time", endDate.toISOString())
                .order("alarm_id", { ascending: true })
                .range(rangeFrom, rangeTo);
            if (siteIds !== null) {
                q = q.in("site", siteIds);
            }
            return q;
        });

        if (error || !data) {
            res.status(500).json({ message: error?.message ?? "No data" });
            return;
        }

        const grouped: Record<string, number> = {};
        data.forEach((alarm: any) => {
            const label = bucketLabel(new Date(alarm.start_time), granularity, startDate, endDate);
            grouped[label] = (grouped[label] || 0) + 1;
        });

        const result: { date: string; value: number }[] = [];
        forEachBucket(startDate, endDate, granularity, (label) => {
            result.push({ date: label, value: grouped[label] || 0 });
        });

        res.json(result);
    });

    /**
     * Returns the number of alarms per bucket split by severity (Low / Medium / High).
     * Bucket size is controlled by the optional 'granularity' query param (day, week, month).
     * Severity is resolved through the alarm_types join on alarms.alarm_type_id -> alarm_types.severity.
     * When 'siteId' is provided (single value or comma-separated list), only alarms on those sites are counted.
     */
    router.get("/alarms/chart-by-severity", async (req: Request, res: Response) => {
        const siteIds = parseSiteIds(req.query.siteId);
        const { startDate, endDate } = parseDateRange(req.query.from, req.query.to);
        const granularity = parseGranularity(req.query.granularity);

        const { data, error } = await fetchAll<any>((rangeFrom, rangeTo) => {
            let q = supabase
                .from("alarms")
                .select("start_time, alarm_types(severity)")
                .gte("start_time", startDate.toISOString())
                .lte("start_time", endDate.toISOString())
                .order("alarm_id", { ascending: true })
                .range(rangeFrom, rangeTo);
            if (siteIds !== null) {
                q = q.in("site", siteIds);
            }
            return q;
        });

        if (error || !data) {
            res.status(500).json({ message: error?.message ?? "No data" });
            return;
        }

        const severityLabel = (s: number): "Low" | "Medium" | "High" | null => {
            if (s === 1) return "Low";
            if (s === 2) return "Medium";
            if (s === 3) return "High";
            return null;
        };

        const grouped: Record<string, Record<string, number>> = {};
        data.forEach((alarm: any) => {
            const label = bucketLabel(new Date(alarm.start_time), granularity, startDate, endDate);
            if (!grouped[label]) {
                grouped[label] = { Low: 0, Medium: 0, High: 0 };
            }
            const sev = alarm.alarm_types?.severity;
            const sevLabel = severityLabel(sev);
            if (sevLabel) {
                grouped[label][sevLabel] += 1;
            }
        });

        const result: { date: string; Low: number; Medium: number; High: number }[] = [];
        forEachBucket(startDate, endDate, granularity, (label) => {
            const day = grouped[label] ?? { Low: 0, Medium: 0, High: 0 };
            result.push({
                date: label,
                Low: day.Low ?? 0,
                Medium: day.Medium ?? 0,
                High: day.High ?? 0,
            });
        });

        res.json(result);
    });

    /**
     * Returns the distribution of alarms by technology for the requested date range.
     * Alarms without a technology value are bucketed under "Unknown".
     * When 'siteId' is provided (single value or comma-separated list), only alarms on those sites are counted.
     */
    router.get("/alarms/by-technology", async (req: Request, res: Response) => {
        const siteIds = parseSiteIds(req.query.siteId);
        const { startDate, endDate } = parseDateRange(req.query.from, req.query.to);

        const { data, error } = await fetchAll<{ tehnologie: string | null }>((rangeFrom, rangeTo) => {
            let q = supabase
                .from("alarms")
                .select("tehnologie")
                .gte("start_time", startDate.toISOString())
                .lte("start_time", endDate.toISOString())
                .order("alarm_id", { ascending: true })
                .range(rangeFrom, rangeTo);
            if (siteIds !== null) {
                q = q.in("site", siteIds);
            }
            return q;
        });

        if (error || !data) {
            res.status(500).json({ message: error?.message ?? "No data" });
            return;
        }

        const counts: Record<string, number> = {};
        data.forEach((alarm: any) => {
            const tech = alarm.tehnologie ?? "Unknown";
            counts[tech] = (counts[tech] || 0) + 1;
        });

        const result = Object.entries(counts).map(([name, value]) => ({ name, value }));
        res.json(result);
    });

    return router;
};

export default createAlarmsRouter;