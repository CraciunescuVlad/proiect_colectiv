import { Router, Request, Response } from "express";
import { SupabaseClient } from "@supabase/supabase-js";

// Paginates over Supabase results to bypass the default 1000-row limit
// Returns all rows matching the filters applied via the builder callback
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

// Parses the optional 'siteId' query param into a number, or null if not provided
const parseSiteId = (raw: any): string | null => {
    if (typeof raw !== "string" || raw.trim() === "") {
        return null;
    }
    return raw.trim();
};

// Resolves the alarm IDs linked to a given site through the alarms table
// Returns an empty array if no alarms exist on that site
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

// Resolves the incident IDs that have at least one alarm on the given site
// Uses the incident_alarms junction table
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

const createStatisticsRouter = (supabase: SupabaseClient) => {
    const router = Router();

    router.get("/test", (req: Request, res: Response) => {
        res.json({ message: "statistics router works" })
    })

    router.get("/sites", async (req: Request, res: Response) => {
        const { data, error } = await fetchAll<{ id: string }>((rangeFrom, rangeTo) =>
            supabase
                .from("site")
                .select("id")
                .order("id", { ascending: true })
                .range(rangeFrom, rangeTo)
        );

        if (error || !data) {
            res.status(500).json({ message: error?.message ?? "No data" })
            return
        }

        // Map id -> site_id so the frontend receives the expected shape
        const result = data.map(row => ({ site_id: row.id }));
        res.json(result);
    })

    // Returns the number of incidents per day in a given date range
    // Defaults to the last 30 days if 'from' and 'to' are not provided
    // If 'siteId' is provided, only incidents linked to that site (via incident_alarms -> alarms.site) are counted
    router.get("/incidents/chart", async (req: Request, res: Response) => {
        const { from, to } = req.query;
        const siteId = parseSiteId(req.query.siteId);

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

        // Resolve incident IDs for the selected site, if any
        let incidentFilter: number[] | null = null;
        if (siteId !== null) {
            const { incidentIds, error: resolveErr } = await getIncidentIdsForSite(supabase, siteId);
            if (resolveErr) {
                res.status(500).json({ message: resolveErr.message ?? "No data" })
                return
            }
            incidentFilter = incidentIds;
        }

        let query = supabase
            .from("incidents")
            .select("start_time")
            .gte("start_time", startDate.toISOString())
            .lte("start_time", endDate.toISOString())

        if (incidentFilter !== null) {
            if (incidentFilter.length === 0) {
                // No incidents on this site -> return empty chart with zeros
                const result: { date: string; value: number }[] = [];
                const cursor = new Date(startDate);
                cursor.setHours(0, 0, 0, 0);
                const lastDay = new Date(endDate);
                lastDay.setHours(0, 0, 0, 0);
                while (cursor <= lastDay) {
                    const label = cursor.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit" });
                    result.push({ date: label, value: 0 });
                    cursor.setDate(cursor.getDate() + 1);
                }
                res.json(result);
                return;
            }
            query = query.in("incident_id", incidentFilter);
        }

        const { data, error } = await query;

        if (error || !data) {
            res.status(500).json({ message: error?.message ?? "No data" })
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

    // Returns the number of alarms per day in a given date range
    // If 'siteId' is provided, only alarms on that site are counted
    router.get("/alarms/chart", async (req: Request, res: Response) => {
        const { from, to } = req.query;
        const siteId = parseSiteId(req.query.siteId);

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
            res.status(500).json({ message: error?.message ?? "No data" })
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

    // Returns the number of alarms per day, split by severity (Low/Medium/High)
    // If 'siteId' is provided, only alarms on that site are counted
    router.get("/alarms/chart-by-severity", async (req: Request, res: Response) => {
        const { from, to } = req.query;
        const siteId = parseSiteId(req.query.siteId);

        let startDate: Date;
        let endDate: Date;

        if (from && to && typeof from === "string" && typeof to === "string") {
            startDate = new Date(`${from}T00:00:00`);
            endDate = new Date(`${to}T23:59:59.999`);
        } else {
            endDate = new Date();
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        }

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
            res.status(500).json({ message: error?.message ?? "No data" })
            return
        }

        const severityLabel = (s: number): "Low" | "Medium" | "High" | null => {
            if (s === 1) return "Low";
            if (s === 2) return "Medium";
            if (s === 3) return "High";
            return null;
        };
        // Count alarms per (day, severity)
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
            result.push({
                date: label,
                Low: day.Low ?? 0,
                Medium: day.Medium ?? 0,
                High: day.High ?? 0,
            });
            cursor.setDate(cursor.getDate() + 1);
        }

        res.json(result)
    })

    // Returns the number of incidents per day, split by priority
    // If 'siteId' is provided, only incidents linked to that site are counted
    router.get("/incidents/chart-by-priority", async (req: Request, res: Response) => {
        const { from, to } = req.query;
        const siteId = parseSiteId(req.query.siteId);

        let startDate: Date;
        let endDate: Date;

        if (from && to && typeof from === "string" && typeof to === "string") {
            startDate = new Date(`${from}T00:00:00`);
            endDate = new Date(`${to}T23:59:59.999`);
        } else {
            endDate = new Date();
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        }

        // Resolve incident IDs for the selected site, if any
        let incidentFilter: number[] | null = null;
        if (siteId !== null) {
            const { incidentIds, error: resolveErr } = await getIncidentIdsForSite(supabase, siteId);
            if (resolveErr) {
                res.status(500).json({ message: resolveErr.message ?? "No data" })
                return
            }
            incidentFilter = incidentIds;
        }

        let query = supabase
            .from("incidents")
            .select("start_time, priority")
            .gte("start_time", startDate.toISOString())
            .lte("start_time", endDate.toISOString())

        if (incidentFilter !== null) {
            if (incidentFilter.length === 0) {
                const result: { date: string; Warning: number; Minor: number; Major: number; Critical: number }[] = [];
                const cursor = new Date(startDate);
                cursor.setHours(0, 0, 0, 0);
                const lastDay = new Date(endDate);
                lastDay.setHours(0, 0, 0, 0);
                while (cursor <= lastDay) {
                    const label = cursor.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit" });
                    result.push({ date: label, Warning: 0, Minor: 0, Major: 0, Critical: 0 });
                    cursor.setDate(cursor.getDate() + 1);
                }
                res.json(result);
                return;
            }
            query = query.in("incident_id", incidentFilter);
        }

        const { data, error } = await query;

        if (error || !data) {
            res.status(500).json({ message: error?.message ?? "No data" })
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
    // If 'siteId' is provided, only incidents linked to that site are counted
    router.get("/incidents/avg-resolution/chart", async (req: Request, res: Response) => {
        const { from, to } = req.query;
        const siteId = parseSiteId(req.query.siteId);

        let startDate: Date;
        let endDate: Date;

        if (from && to && typeof from === "string" && typeof to === "string") {
            startDate = new Date(`${from}T00:00:00`);
            endDate = new Date(`${to}T23:59:59.999`);
        } else {
            endDate = new Date();
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        }

        // Resolve incident IDs for the selected site, if any
        let incidentFilter: number[] | null = null;
        if (siteId !== null) {
            const { incidentIds, error: resolveErr } = await getIncidentIdsForSite(supabase, siteId);
            if (resolveErr) {
                res.status(500).json({ message: resolveErr.message ?? "No data" })
                return
            }
            incidentFilter = incidentIds;
        }

        let query = supabase
            .from("incidents")
            .select("start_time, end_time")
            .not("end_time", "is", null)
            .gte("end_time", startDate.toISOString())
            .lte("end_time", endDate.toISOString())

        if (incidentFilter !== null) {
            if (incidentFilter.length === 0) {
                const result: { date: string; value: number }[] = [];
                const cursor = new Date(startDate);
                cursor.setHours(0, 0, 0, 0);
                const lastDay = new Date(endDate);
                lastDay.setHours(0, 0, 0, 0);
                while (cursor <= lastDay) {
                    const label = cursor.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit" });
                    result.push({ date: label, value: 0 });
                    cursor.setDate(cursor.getDate() + 1);
                }
                res.json(result);
                return;
            }
            query = query.in("incident_id", incidentFilter);
        }

        const { data, error } = await query;

        if (error || !data) {
            res.status(500).json({ message: error?.message ?? "No data" })
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

    // Returns the distribution of alarms by technology for a given date range
    // If 'siteId' is provided, only alarms on that site are counted
    router.get("/alarms/by-technology", async (req: Request, res: Response) => {
        const { from, to } = req.query;
        const siteId = parseSiteId(req.query.siteId);

        let startDate: Date;
        let endDate: Date;

        if (from && to && typeof from === "string" && typeof to === "string") {
            startDate = new Date(`${from}T00:00:00`);
            endDate = new Date(`${to}T23:59:59.999`);
        } else {
            endDate = new Date();
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        }

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
            res.status(500).json({ message: error?.message ?? "No data" })
            return
        }

        // Count alarms per technology
        const counts: Record<string, number> = {};
        data.forEach((alarm: any) => {
            const tech = alarm.tehnologie ?? "Unknown";
            counts[tech] = (counts[tech] || 0) + 1;
        });

        const result = Object.entries(counts).map(([name, value]) => ({ name, value }));
        res.json(result);
    })

    // Returns the distribution of incidents by technology, derived from their linked alarms
    // An incident with alarms on multiple technologies is counted once per distinct technology
    // If 'siteId' is provided, only incidents linked to that site are counted
    router.get("/incidents/by-technology", async (req: Request, res: Response) => {
        const { from, to } = req.query;
        const siteId = parseSiteId(req.query.siteId);

        let startDate: Date;
        let endDate: Date;

        if (from && to && typeof from === "string" && typeof to === "string") {
            startDate = new Date(`${from}T00:00:00`);
            endDate = new Date(`${to}T23:59:59.999`);
        } else {
            endDate = new Date();
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        }

        // Resolve incident IDs for the selected site, if any
        let incidentFilter: number[] | null = null;
        if (siteId !== null) {
            const { incidentIds, error: resolveErr } = await getIncidentIdsForSite(supabase, siteId);
            if (resolveErr) {
                res.status(500).json({ message: resolveErr.message ?? "No data" })
                return
            }
            incidentFilter = incidentIds;
            if (incidentFilter.length === 0) {
                res.json([]);
                return;
            }
        }

        let incQuery = supabase
            .from("incidents")
            .select("incident_id")
            .gte("start_time", startDate.toISOString())
            .lte("start_time", endDate.toISOString())

        if (incidentFilter !== null) {
            incQuery = incQuery.in("incident_id", incidentFilter);
        }

        const { data: incidents, error: incError } = await fetchAll<{ incident_id: number }>((rangeFrom, rangeTo) =>
            incQuery.range(rangeFrom, rangeTo)
        );

        if (incError || !incidents) {
            res.status(500).json({ message: incError?.message ?? "No data" })
            return
        }
        if (incidents.length === 0) {
            res.json([]);
            return;
        }

        const incidentIds = incidents.map(i => i.incident_id);

        // Step 2: get alarm IDs linked to those incidents
        const { data: links, error: linkError } = await fetchAll<{ incident_id: number; alarm_id: number }>((rangeFrom, rangeTo) =>
            supabase
                .from("incident_alarms")
                .select("incident_id, alarm_id")
                .in("incident_id", incidentIds)
                .range(rangeFrom, rangeTo)
        );

        if (linkError || !links) {
            res.status(500).json({ message: linkError?.message ?? "No data" })
            return
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
            res.status(500).json({ message: alarmError?.message ?? "No data" })
            return
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
            if (tech) incidentTechs[l.incident_id].add(tech);
        });

        const counts: Record<string, number> = {};
        Object.values(incidentTechs).forEach(techSet => {
            techSet.forEach(tech => {
                counts[tech] = (counts[tech] || 0) + 1;
            });
        });

        const result = Object.entries(counts).map(([name, value]) => ({ name, value }));
        res.json(result);
    })

    return router;
}

export default createStatisticsRouter;