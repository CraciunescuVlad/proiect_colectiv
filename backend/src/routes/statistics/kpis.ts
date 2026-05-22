import { Router, Request, Response } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import {
    fetchAll,
    parseSiteIds,
    parseDateRange,
    getPreviousRange,
} from "./helpers";
import { resolveIncidentFilter } from "./filters";

/**
 * Computes the percentage change between a current and a previous count.
 * Returns 0 when the previous count is 0 to avoid division by zero, unless the
 * current count is also positive (in which case the change is reported as 100).
 *
 * @param current The count in the current period
 * @param previous The count in the previous period
 * @return The rounded percentage change
 */
const percentChange = (current: number, previous: number): number => {
    if (previous === 0) {
        if (current === 0) {
            return 0;
        }
        return 100;
    }
    return Math.round(((current - previous) / previous) * 100);
};

/**
 * Builds the router for the overview KPI cards on the Statistics page.
 *
 * @param supabase The Supabase client used by every endpoint
 * @return The configured Express router
 */
const createKpisRouter = (supabase: SupabaseClient) => {
    const router = Router();

    /**
     * Returns 4 overview KPIs for the selected range, each with a period-over-period
     * percentage change against the immediately-preceding range of equal length:
     * - alarmsTotal: alarms with start_time in the range
     * - alarmsResolved: alarms with status = 0 and start_time in the range
     * - incidentsTotal: incidents with start_time in the range
     * - incidentsResolved: incidents with end_time not null in the range
     * When 'siteId' is provided (single value or comma-separated list), all counts are
     * restricted to those sites.
     */
    router.get("/overview-kpis", async (req: Request, res: Response) => {
        const siteIds = parseSiteIds(req.query.siteId);
        const { startDate, endDate } = parseDateRange(req.query.from, req.query.to);
        const { prevStart, prevEnd } = getPreviousRange(startDate, endDate);

        // Resolve the incident filter once for the current range; it does not depend on dates
        const { incidentFilter, error: filterErr } = await resolveIncidentFilter(supabase, siteIds, null);
        if (filterErr) {
            res.status(500).json({ message: filterErr.message ?? "No data" });
            return;
        }

        // If a site filter is active but matches no incidents, incident counts are all zero
        const noIncidents = incidentFilter !== null && incidentFilter.length === 0;

        /**
         * Counts alarms with start_time inside the given range, optionally filtered by site
         * and optionally restricted to resolved alarms (status = 0).
         */
        const countAlarms = async (
            from: Date,
            to: Date,
            onlyResolved: boolean
        ): Promise<{ count: number; error: any }> => {
            const { data, error } = await fetchAll<{ alarm_id: number }>((rangeFrom, rangeTo) => {
                let q = supabase
                    .from("alarms")
                    .select("alarm_id")
                    .gte("start_time", from.toISOString())
                    .lte("start_time", to.toISOString())
                    .order("alarm_id", { ascending: true })
                    .range(rangeFrom, rangeTo);
                if (siteIds !== null) {
                    q = q.in("site", siteIds);
                }
                if (onlyResolved) {
                    q = q.eq("status", 0);
                }
                return q;
            });
            if (error || !data) {
                return { count: 0, error };
            }
            return { count: data.length, error: null };
        };

        /**
         * Counts incidents with start_time inside the given range, optionally restricted to
         * the resolved set (end_time not null) and to the site-derived incident filter.
         */
        const countIncidents = async (
            from: Date,
            to: Date,
            onlyResolved: boolean
        ): Promise<{ count: number; error: any }> => {
            if (noIncidents) {
                return { count: 0, error: null };
            }
            const { data, error } = await fetchAll<{ incident_id: number }>((rangeFrom, rangeTo) => {
                let q = supabase
                    .from("incidents")
                    .select("incident_id")
                    .order("incident_id", { ascending: true })
                    .range(rangeFrom, rangeTo);
                if (onlyResolved) {
                    q = q
                        .not("end_time", "is", null)
                        .gte("end_time", from.toISOString())
                        .lte("end_time", to.toISOString());
                } else {
                    q = q
                        .gte("start_time", from.toISOString())
                        .lte("start_time", to.toISOString());
                }
                if (incidentFilter !== null) {
                    q = q.in("incident_id", incidentFilter);
                }
                return q;
            });
            if (error || !data) {
                return { count: 0, error };
            }
            return { count: data.length, error: null };
        };

        // Current period
        const alarmsTotalCur = await countAlarms(startDate, endDate, false);
        const alarmsResolvedCur = await countAlarms(startDate, endDate, true);
        const incidentsTotalCur = await countIncidents(startDate, endDate, false);
        const incidentsResolvedCur = await countIncidents(startDate, endDate, true);

        // Previous period
        const alarmsTotalPrev = await countAlarms(prevStart, prevEnd, false);
        const alarmsResolvedPrev = await countAlarms(prevStart, prevEnd, true);
        const incidentsTotalPrev = await countIncidents(prevStart, prevEnd, false);
        const incidentsResolvedPrev = await countIncidents(prevStart, prevEnd, true);

        const allResults = [
            alarmsTotalCur, alarmsResolvedCur, incidentsTotalCur, incidentsResolvedCur,
            alarmsTotalPrev, alarmsResolvedPrev, incidentsTotalPrev, incidentsResolvedPrev,
        ];
        const failed = allResults.find((r) => r.error);
        if (failed) {
            res.status(500).json({ message: failed.error?.message ?? "No data" });
            return;
        }

        res.json({
            alarmsTotal: {
                value: alarmsTotalCur.count,
                changePercent: percentChange(alarmsTotalCur.count, alarmsTotalPrev.count),
            },
            alarmsResolved: {
                value: alarmsResolvedCur.count,
                changePercent: percentChange(alarmsResolvedCur.count, alarmsResolvedPrev.count),
            },
            incidentsTotal: {
                value: incidentsTotalCur.count,
                changePercent: percentChange(incidentsTotalCur.count, incidentsTotalPrev.count),
            },
            incidentsResolved: {
                value: incidentsResolvedCur.count,
                changePercent: percentChange(incidentsResolvedCur.count, incidentsResolvedPrev.count),
            },
        });
    });

    return router;
};

export default createKpisRouter;