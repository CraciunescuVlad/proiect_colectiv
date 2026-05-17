import { Router, Request, Response } from "express";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Paginates over Supabase results to bypass the default 1000-row limit.
 * Calls the builder repeatedly with sliding ranges until a short page is returned.
 *
 * @param buildQuery Callback that receives the current range bounds and returns a Supabase query
 * @return All rows aggregated across pages, or an error if any page fails
 */
const fetchAll = async <T>(
    buildQuery: (from: number, to: number) => any
): Promise<{ data: T[]; error: null } | { data: null; error: any }> => {
    const pageSize = 1000;
    let page = 0;
    const all: T[] = [];

    while (true) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await buildQuery(from, to);

        if (error) {
            return { data: null, error };
        }
        if (!data || data.length === 0) {
            break;
        }
        all.push(...data);
        if (data.length < pageSize) {
            break;
        }
        page += 1;
    }

    return { data: all, error: null };
};

/**
 * Parses the optional 'siteId' query param into a trimmed string, or null if missing or blank.
 *
 * @param raw The raw query param value
 * @return The trimmed site id, or null if not provided
 */
const parseSiteId = (raw: any): string | null => {
    if (typeof raw !== "string" || raw.trim() === "") {
        return null;
    }
    return raw.trim();
};

/**
 * Parses the optional 'from' and 'to' query params into Date objects.
 * Both bounds are anchored at local midnight and local end-of-day to align with the chart labels.
 * Falls back to the last 30 days when either param is missing.
 *
 * @param rawFrom The raw 'from' query param value
 * @param rawTo The raw 'to' query param value
 * @return The resolved start and end Date objects
 */
const parseDateRange = (rawFrom: any, rawTo: any): { startDate: Date; endDate: Date } => {
    if (typeof rawFrom === "string" && typeof rawTo === "string" && rawFrom !== "" && rawTo !== "") {
        return {
            startDate: new Date(`${rawFrom}T00:00:00`),
            endDate: new Date(`${rawTo}T23:59:59.999`),
        };
    }
    return {
        endDate: new Date(),
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    };
};

/**
 * Formats a Date as a "DD/MM" label in Romanian locale.
 * Used as the x-axis key on every chart so labels stay consistent across endpoints.
 *
 * @param d The Date to format
 * @return The formatted day label
 */
const formatDayLabel = (d: Date): string => {
    return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit" });
};

/**
 * Iterates day by day from startDate to endDate (inclusive), invoking the callback with each day's label.
 * Both bounds are normalized to local midnight before iteration.
 *
 * @param startDate The first day to include
 * @param endDate The last day to include
 * @param callback Function invoked once per day with the formatted day label
 */
const forEachDay = (
    startDate: Date,
    endDate: Date,
    callback: (label: string) => void
): void => {
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);
    const lastDay = new Date(endDate);
    lastDay.setHours(0, 0, 0, 0);

    while (cursor <= lastDay) {
        callback(formatDayLabel(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
};

/**
 * Resolves the alarm IDs linked to a given site through the alarms table.
 *
 * @param supabase The Supabase client
 * @param siteId The site id to filter alarms by
 * @return The alarm IDs found on that site, or an error
 */
const getAlarmIdsForSite = async (
    supabase: SupabaseClient,
    siteId: string
): Promise<{ alarmIds: number[]; error: any }> => {
    const { data, error } = await fetchAll<{ alarm_id: number }>((rangeFrom, rangeTo) =>
        supabase
            .from("alarms")
            .select("alarm_id")
            .eq("site", siteId)
            .range(rangeFrom, rangeTo)
    );
    if (error || !data) {
        return { alarmIds: [], error };
    }
    return { alarmIds: data.map(a => a.alarm_id), error: null };
};

/**
 * Resolves the incident IDs that have at least one alarm on the given site.
 * Walks the chain alarms.site -> alarm_id -> incident_alarms.incident_id and deduplicates the result.
 *
 * @param supabase The Supabase client
 * @param siteId The site id to filter incidents by
 * @return The unique incident IDs linked to that site, or an error
 */
const getIncidentIdsForSite = async (
    supabase: SupabaseClient,
    siteId: string
): Promise<{ incidentIds: number[]; error: any }> => {
    const { alarmIds, error: alarmErr } = await getAlarmIdsForSite(supabase, siteId);
    if (alarmErr) {
        return { incidentIds: [], error: alarmErr };
    }
    if (alarmIds.length === 0) {
        return { incidentIds: [], error: null };
    }

    const { data, error } = await fetchAll<{ incident_id: number }>((rangeFrom, rangeTo) =>
        supabase
            .from("incident_alarms")
            .select("incident_id")
            .in("alarm_id", alarmIds)
            .range(rangeFrom, rangeTo)
    );
    if (error || !data) {
        return { incidentIds: [], error };
    }
    const unique = [...new Set(data.map(l => l.incident_id))];
    return { incidentIds: unique, error: null };
};

/**
 * Resolves the incident filter for a given site.
 * Returns null when no site filter is requested, so callers can skip the .in() clause entirely.
 * An empty array means the site has no incidents and the caller should short-circuit.
 *
 * @param supabase The Supabase client
 * @param siteId The site id to filter by, or null for no filter
 * @return The list of incident IDs to filter by, or null if no filter is needed
 */
const resolveIncidentFilter = async (
    supabase: SupabaseClient,
    siteId: string | null
): Promise<{ incidentFilter: number[] | null; error: any }> => {
    if (siteId === null) {
        return { incidentFilter: null, error: null };
    }
    const { incidentIds, error } = await getIncidentIdsForSite(supabase, siteId);
    if (error) {
        return { incidentFilter: null, error };
    }
    return { incidentFilter: incidentIds, error: null };
};

/**
 * Builds the Express router exposing all statistics endpoints.
 * Each endpoint reads optional 'from', 'to', and 'siteId' query params and returns chart-ready data.
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

    /**
     * Returns the number of incidents per day in the requested date range.
     * When 'siteId' is provided, only incidents linked to that site (via incident_alarms -> alarms.site) are counted.
     * Days with no incidents are filled with zero so the chart shows a continuous timeline.
     */
    router.get("/incidents/chart", async (req: Request, res: Response) => {
        const siteId = parseSiteId(req.query.siteId);
        const { startDate, endDate } = parseDateRange(req.query.from, req.query.to);

        const { incidentFilter, error: filterErr } = await resolveIncidentFilter(supabase, siteId);
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
     * Returns the number of alarms per day in the requested date range.
     * When 'siteId' is provided, only alarms on that site are counted.
     * Days with no alarms are filled with zero so the chart shows a continuous timeline.
     */
    router.get("/alarms/chart", async (req: Request, res: Response) => {
        const siteId = parseSiteId(req.query.siteId);
        const { startDate, endDate } = parseDateRange(req.query.from, req.query.to);

        const { data, error } = await fetchAll<{ start_time: string }>((rangeFrom, rangeTo) => {
            let q = supabase
                .from("alarms")
                .select("start_time")
                .gte("start_time", startDate.toISOString())
                .lte("start_time", endDate.toISOString())
                .range(rangeFrom, rangeTo);
            if (siteId !== null) {
                q = q.eq("site", siteId);
            }
            return q;
        });

        if (error || !data) {
            res.status(500).json({ message: error?.message ?? "No data" });
            return;
        }

        const grouped: Record<string, number> = {};
        data.forEach((alarm: any) => {
            const label = formatDayLabel(new Date(alarm.start_time));
            grouped[label] = (grouped[label] || 0) + 1;
        });

        const result: { date: string; value: number }[] = [];
        forEachDay(startDate, endDate, (label) => {
            result.push({ date: label, value: grouped[label] || 0 });
        });

        res.json(result);
    });

    /**
     * Returns the number of alarms per day split by severity (Low / Medium / High).
     * Severity is resolved through the alarm_types join on alarms.alarm_type_id -> alarm_types.severity.
     * When 'siteId' is provided, only alarms on that site are counted.
     */
    router.get("/alarms/chart-by-severity", async (req: Request, res: Response) => {
        const siteId = parseSiteId(req.query.siteId);
        const { startDate, endDate } = parseDateRange(req.query.from, req.query.to);

        const { data, error } = await fetchAll<any>((rangeFrom, rangeTo) => {
            let q = supabase
                .from("alarms")
                .select("start_time, alarm_types(severity)")
                .gte("start_time", startDate.toISOString())
                .lte("start_time", endDate.toISOString())
                .range(rangeFrom, rangeTo);
            if (siteId !== null) {
                q = q.eq("site", siteId);
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
            const label = formatDayLabel(new Date(alarm.start_time));
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
        forEachDay(startDate, endDate, (label) => {
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
     * Returns the number of incidents per day split by priority (Warning / Minor / Major / Critical).
     * When 'siteId' is provided, only incidents linked to that site are counted.
     */
    router.get("/incidents/chart-by-priority", async (req: Request, res: Response) => {
        const siteId = parseSiteId(req.query.siteId);
        const { startDate, endDate } = parseDateRange(req.query.from, req.query.to);

        const { incidentFilter, error: filterErr } = await resolveIncidentFilter(supabase, siteId);
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
     */
    router.get("/incidents/avg-resolution/chart", async (req: Request, res: Response) => {
        const siteId = parseSiteId(req.query.siteId);
        const { startDate, endDate } = parseDateRange(req.query.from, req.query.to);

        const { incidentFilter, error: filterErr } = await resolveIncidentFilter(supabase, siteId);
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
     * Returns the distribution of alarms by technology for the requested date range.
     * Alarms without a technology value are bucketed under "Unknown".
     * When 'siteId' is provided, only alarms on that site are counted.
     */
    router.get("/alarms/by-technology", async (req: Request, res: Response) => {
        const siteId = parseSiteId(req.query.siteId);
        const { startDate, endDate } = parseDateRange(req.query.from, req.query.to);

        const { data, error } = await fetchAll<{ tehnologie: string | null }>((rangeFrom, rangeTo) => {
            let q = supabase
                .from("alarms")
                .select("tehnologie")
                .gte("start_time", startDate.toISOString())
                .lte("start_time", endDate.toISOString())
                .range(rangeFrom, rangeTo);
            if (siteId !== null) {
                q = q.eq("site", siteId);
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

    /**
     * Returns the distribution of incidents by technology, derived from their linked alarms.
     * An incident with alarms on multiple technologies is counted once per distinct technology.
     * When 'siteId' is provided, only incidents linked to that site are counted.
     */
    router.get("/incidents/by-technology", async (req: Request, res: Response) => {
        const siteId = parseSiteId(req.query.siteId);
        const { startDate, endDate } = parseDateRange(req.query.from, req.query.to);

        const { incidentFilter, error: filterErr } = await resolveIncidentFilter(supabase, siteId);
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

    return router;
};

export default createStatisticsRouter;