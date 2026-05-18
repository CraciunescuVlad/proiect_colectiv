import { Router, Request, Response } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import {
    fetchAll,
    parseSiteId,
    parseAssignedTo,
    parseDateRange,
    formatDayLabel,
    forEachDay,
} from "./helpers";
import { resolveIncidentFilter } from "./filters";

/**
 * Builds the router for incident-related statistics endpoints.
 *
 * @param supabase The Supabase client used by every endpoint
 * @return The configured Express router
 */
const createIncidentsRouter = (supabase: SupabaseClient) => {
    const router = Router();

    /**
     * Returns the number of incidents per day in the requested date range.
     * When 'siteId' is provided, only incidents linked to that site (via incident_alarms -> alarms.site) are counted.
     * When 'assignedTo' is provided, only incidents assigned to that user are counted.
     * Days with no incidents are filled with zero so the chart shows a continuous timeline.
     */
    router.get("/incidents/chart", async (req: Request, res: Response) => {
        const siteId = parseSiteId(req.query.siteId);
        const assignedTo = parseAssignedTo(req.query.assignedTo);
        const { startDate, endDate } = parseDateRange(req.query.from, req.query.to);

        const { incidentFilter, error: filterErr } = await resolveIncidentFilter(supabase, siteId, assignedTo);
        if (filterErr) {
            res.status(500).json({ message: filterErr.message ?? "No data" });
            return;
        }

        if (incidentFilter !== null && incidentFilter.length === 0) {
            const empty: { date: string; value: number }[] = [];
            forEachDay(startDate, endDate, (label) => {
                empty.push({ date: label, value: 0 });
            });
            res.json(empty);
            return;
        }

        let query = supabase
            .from("incidents")
            .select("start_time")
            .gte("start_time", startDate.toISOString())
            .lte("start_time", endDate.toISOString());

        if (incidentFilter !== null) {
            query = query.in("incident_id", incidentFilter);
        }

        const { data, error } = await query;

        if (error || !data) {
            res.status(500).json({ message: error?.message ?? "No data" });
            return;
        }

        const grouped: Record<string, number> = {};
        data.forEach((incident: any) => {
            const label = formatDayLabel(new Date(incident.start_time));
            grouped[label] = (grouped[label] || 0) + 1;
        });

        const result: { date: string; value: number }[] = [];
        forEachDay(startDate, endDate, (label) => {
            result.push({ date: label, value: grouped[label] || 0 });
        });

        res.json(result);
    });

    /**
     * Returns the number of incidents per day split by priority (Warning / Minor / Major / Critical).
     * When 'siteId' is provided, only incidents linked to that site are counted.
     * When 'assignedTo' is provided, only incidents assigned to that user are counted.
     */
    router.get("/incidents/chart-by-priority", async (req: Request, res: Response) => {
        const siteId = parseSiteId(req.query.siteId);
        const assignedTo = parseAssignedTo(req.query.assignedTo);
        const { startDate, endDate } = parseDateRange(req.query.from, req.query.to);

        const { incidentFilter, error: filterErr } = await resolveIncidentFilter(supabase, siteId, assignedTo);
        if (filterErr) {
            res.status(500).json({ message: filterErr.message ?? "No data" });
            return;
        }

        if (incidentFilter !== null && incidentFilter.length === 0) {
            const empty: { date: string; Warning: number; Minor: number; Major: number; Critical: number }[] = [];
            forEachDay(startDate, endDate, (label) => {
                empty.push({ date: label, Warning: 0, Minor: 0, Major: 0, Critical: 0 });
            });
            res.json(empty);
            return;
        }

        let query = supabase
            .from("incidents")
            .select("start_time, priority")
            .gte("start_time", startDate.toISOString())
            .lte("start_time", endDate.toISOString());

        if (incidentFilter !== null) {
            query = query.in("incident_id", incidentFilter);
        }

        const { data, error } = await query;

        if (error || !data) {
            res.status(500).json({ message: error?.message ?? "No data" });
            return;
        }

        const grouped: Record<string, Record<string, number>> = {};
        data.forEach((incident: any) => {
            const label = formatDayLabel(new Date(incident.start_time));
            if (!grouped[label]) {
                grouped[label] = { Warning: 0, Minor: 0, Major: 0, Critical: 0 };
            }
            const p = incident.priority;
            if (p === "Warning" || p === "Minor" || p === "Major" || p === "Critical") {
                grouped[label][p] += 1;
            }
        });

        const result: { date: string; Warning: number; Minor: number; Major: number; Critical: number }[] = [];
        forEachDay(startDate, endDate, (label) => {
            const day = grouped[label] ?? { Warning: 0, Minor: 0, Major: 0, Critical: 0 };
            result.push({
                date: label,
                Warning: day.Warning,
                Minor: day.Minor,
                Major: day.Major,
                Critical: day.Critical,
            });
        });

        res.json(result);
    });

    /**
     * Returns the average resolution time per day (in minutes), grouped by the incident's end_time.
     * Incidents with a negative duration (data inconsistency) are skipped.
     * When 'siteId' is provided, only incidents linked to that site are counted.
     * When 'assignedTo' is provided, only incidents assigned to that user are counted.
     */
    router.get("/incidents/avg-resolution/chart", async (req: Request, res: Response) => {
        const siteId = parseSiteId(req.query.siteId);
        const assignedTo = parseAssignedTo(req.query.assignedTo);
        const { startDate, endDate } = parseDateRange(req.query.from, req.query.to);

        const { incidentFilter, error: filterErr } = await resolveIncidentFilter(supabase, siteId, assignedTo);
        if (filterErr) {
            res.status(500).json({ message: filterErr.message ?? "No data" });
            return;
        }

        if (incidentFilter !== null && incidentFilter.length === 0) {
            const empty: { date: string; value: number }[] = [];
            forEachDay(startDate, endDate, (label) => {
                empty.push({ date: label, value: 0 });
            });
            res.json(empty);
            return;
        }

        let query = supabase
            .from("incidents")
            .select("start_time, end_time")
            .not("end_time", "is", null)
            .gte("end_time", startDate.toISOString())
            .lte("end_time", endDate.toISOString());

        if (incidentFilter !== null) {
            query = query.in("incident_id", incidentFilter);
        }

        const { data, error } = await query;

        if (error || !data) {
            res.status(500).json({ message: error?.message ?? "No data" });
            return;
        }

        const grouped: Record<string, { totalMinutes: number; count: number }> = {};
        data.forEach((incident: any) => {
            const start = new Date(incident.start_time).getTime();
            const end = new Date(incident.end_time).getTime();
            const durationMinutes = (end - start) / (1000 * 60);

            if (durationMinutes < 0) {
                return;
            }

            const label = formatDayLabel(new Date(incident.end_time));
            if (!grouped[label]) {
                grouped[label] = { totalMinutes: 0, count: 0 };
            }
            grouped[label].totalMinutes += durationMinutes;
            grouped[label].count += 1;
        });

        const result: { date: string; value: number }[] = [];
        forEachDay(startDate, endDate, (label) => {
            const day = grouped[label];
            let avg = 0;
            if (day && day.count > 0) {
                avg = Math.round(day.totalMinutes / day.count);
            }
            result.push({ date: label, value: avg });
        });

        res.json(result);
    });

    /**
     * Returns the distribution of incidents by technology, derived from their linked alarms.
     * An incident with alarms on multiple technologies is counted once per distinct technology.
     * When 'siteId' is provided, only incidents linked to that site are counted.
     * When 'assignedTo' is provided, only incidents assigned to that user are counted.
     */
    router.get("/incidents/by-technology", async (req: Request, res: Response) => {
        const siteId = parseSiteId(req.query.siteId);
        const assignedTo = parseAssignedTo(req.query.assignedTo);
        const { startDate, endDate } = parseDateRange(req.query.from, req.query.to);

        const { incidentFilter, error: filterErr } = await resolveIncidentFilter(supabase, siteId, assignedTo);
        if (filterErr) {
            res.status(500).json({ message: filterErr.message ?? "No data" });
            return;
        }

        if (incidentFilter !== null && incidentFilter.length === 0) {
            res.json([]);
            return;
        }

        let incQuery = supabase
            .from("incidents")
            .select("incident_id")
            .gte("start_time", startDate.toISOString())
            .lte("start_time", endDate.toISOString());

        if (incidentFilter !== null) {
            incQuery = incQuery.in("incident_id", incidentFilter);
        }

        const { data: incidents, error: incError } = await fetchAll<{ incident_id: number }>((rangeFrom, rangeTo) =>
            incQuery.range(rangeFrom, rangeTo)
        );

        if (incError || !incidents) {
            res.status(500).json({ message: incError?.message ?? "No data" });
            return;
        }
        if (incidents.length === 0) {
            res.json([]);
            return;
        }

        const incidentIds = incidents.map(i => i.incident_id);

        const { data: links, error: linkError } = await fetchAll<{ incident_id: number; alarm_id: number }>((rangeFrom, rangeTo) =>
            supabase
                .from("incident_alarms")
                .select("incident_id, alarm_id")
                .in("incident_id", incidentIds)
                .range(rangeFrom, rangeTo)
        );

        if (linkError || !links) {
            res.status(500).json({ message: linkError?.message ?? "No data" });
            return;
        }
        if (links.length === 0) {
            res.json([]);
            return;
        }

        const alarmIds = [...new Set(links.map(l => l.alarm_id))];

        const { data: alarms, error: alarmError } = await fetchAll<{ alarm_id: number; tehnologie: string | null }>((rangeFrom, rangeTo) =>
            supabase
                .from("alarms")
                .select("alarm_id, tehnologie")
                .in("alarm_id", alarmIds)
                .range(rangeFrom, rangeTo)
        );

        if (alarmError || !alarms) {
            res.status(500).json({ message: alarmError?.message ?? "No data" });
            return;
        }

        const alarmTech: Record<string, string> = {};
        alarms.forEach((a: any) => {
            alarmTech[a.alarm_id] = a.tehnologie ?? "Unknown";
        });

        const incidentTechs: Record<string, Set<string>> = {};
        links.forEach(l => {
            if (!incidentTechs[l.incident_id]) {
                incidentTechs[l.incident_id] = new Set();
            }
            const tech = alarmTech[l.alarm_id];
            if (tech) {
                incidentTechs[l.incident_id].add(tech);
            }
        });

        const counts: Record<string, number> = {};
        Object.values(incidentTechs).forEach(techSet => {
            techSet.forEach(tech => {
                counts[tech] = (counts[tech] || 0) + 1;
            });
        });

        const result = Object.entries(counts).map(([name, value]) => ({ name, value }));
        res.json(result);
    });

    /**
     * Returns the 3 KPI totals for the viewer statistics view.
     * - avgResolutionMinutes: average resolution time across all resolved incidents in the range
     * - assignedCount: total incidents assigned to the user with start_time in the range
     * - resolvedCount: total resolved incidents with end_time in the range
     * Requires 'assignedTo'; returns 400 otherwise.
     */
    router.get("/incidents/kpis", async (req: Request, res: Response) => {
        const assignedTo = parseAssignedTo(req.query.assignedTo);
        const { startDate, endDate } = parseDateRange(req.query.from, req.query.to);

        if (assignedTo === null) {
            res.status(400).json({ message: "assignedTo is required" });
            return;
        }

        const { data: assignedData, error: assignedErr } = await fetchAll<{ start_time: string }>((rangeFrom, rangeTo) =>
            supabase
                .from("incidents")
                .select("start_time")
                .eq("assigned_to", assignedTo)
                .gte("start_time", startDate.toISOString())
                .lte("start_time", endDate.toISOString())
                .range(rangeFrom, rangeTo)
        );

        if (assignedErr || !assignedData) {
            res.status(500).json({ message: assignedErr?.message ?? "No data" });
            return;
        }

        const { data: resolvedData, error: resolvedErr } = await fetchAll<{ start_time: string; end_time: string }>((rangeFrom, rangeTo) =>
            supabase
                .from("incidents")
                .select("start_time, end_time")
                .eq("assigned_to", assignedTo)
                .not("end_time", "is", null)
                .gte("end_time", startDate.toISOString())
                .lte("end_time", endDate.toISOString())
                .range(rangeFrom, rangeTo)
        );

        if (resolvedErr || !resolvedData) {
            res.status(500).json({ message: resolvedErr?.message ?? "No data" });
            return;
        }

        let totalMinutes = 0;
        let resolvedCount = 0;
        resolvedData.forEach((inc: any) => {
            const start = new Date(inc.start_time).getTime();
            const end = new Date(inc.end_time).getTime();
            const duration = (end - start) / (1000 * 60);
            if (duration >= 0) {
                totalMinutes += duration;
                resolvedCount += 1;
            }
        });

        let avgResolutionMinutes = 0;
        if (resolvedCount > 0) {
            avgResolutionMinutes = Math.round(totalMinutes / resolvedCount);
        }

        res.json({
            avgResolutionMinutes,
            assignedCount: assignedData.length,
            resolvedCount,
        });
    });

    return router;
};

export default createIncidentsRouter;