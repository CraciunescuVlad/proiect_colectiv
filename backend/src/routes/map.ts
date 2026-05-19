import { Router, Request, Response } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import {requireAuth} from "../middleware/auth";

const createMapRouter = (supabase: SupabaseClient) => {
    const router = Router();

    // GET all sites
    router.get("/sites", async (req: Request, res: Response) => {
        const { data, error } = await supabase
            .from("site")
            .select("id, latitudine, longitude, city, address")

        if (error) {
            res.status(500).json({ message: error.message })
            return
        }

        res.json(data)
    })

    // GET site by id
    router.get("/sites/:id", async (req: Request, res: Response) => {
        const { id } = req.params

        const { data, error } = await supabase
            .from("site")
            .select("id, latitudine, longitude, city, address")
            .eq("id", id)
            .single()

        if (error) {
            res.status(404).json({ message: "Site negăsit" })
            return
        }

        res.json(data)
    })

    // GET alarm type details
    router.get("/alarm-type/:typeId", async (req: Request, res: Response) => {
        const { typeId } = req.params

        const { data, error } = await supabase
            .from("alarm_types")
            .select("*")
            .eq("id", typeId)
            .single()

        if (error) {
            res.status(404).json({ message: "Alarm type not found" })
            return
        }

        res.json(data)
    })

    router.get("/sites/:id/alarms", async (req: Request, res: Response) => {
        const { id } = req.params;

        const { data, error } = await supabase
            .from("alarms")
            .select("alarm_id, status, start_time, resolved_time, type, tehnologie, site")
            .eq("site", id)
            .eq("status", 1) // only active alarms

        if (error) {
            res.status(500).json({ message: error.message })
            return
        }

        res.json(data)
    })

    // GET alarms chart for a site
    router.get("/sites/:id/alarms/chart", async (req: Request, res: Response) => {
        const { id } = req.params;

        const { data, error } = await supabase
            .from("alarms")
            .select("start_time")
            .eq("site", id)
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

    // GET incidents chart for a site
    router.get("/sites/:id/incidents/chart", async (req: Request, res: Response) => {
        const { id } = req.params;

        // Step 1: get all alarm_ids for this site
        const { data: alarmsData, error: alarmsError } = await supabase
            .from("alarms")
            .select("alarm_id")
            .eq("site", id)

        if (alarmsError) {
            res.status(500).json({ message: alarmsError.message })
            return
        }

        const alarmIds = alarmsData.map((a: any) => a.alarm_id)

        if (alarmIds.length === 0) {
            res.json([])
            return
        }

        // Step 2: get incident_ids from junction table
        const { data: incidentAlarmsData, error: incidentAlarmsError } = await supabase
            .from("incident_alarms")
            .select("incident_id")
            .in("alarm_id", alarmIds)

        if (incidentAlarmsError) {
            res.status(500).json({ message: incidentAlarmsError.message })
            return
        }

        const incidentIds = [...new Set(incidentAlarmsData.map((i: any) => i.incident_id))]

        if (incidentIds.length === 0) {
            res.json([])
            return
        }

        // Step 3: get incidents by id
        const { data, error } = await supabase
            .from("incidents")
            .select("start_time")
            .in("incident_id", incidentIds)
            .gte("start_time", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

        if (error) {
            res.status(500).json({ message: error.message })
            return
        }

        const grouped: Record<string, number> = {}
        data.forEach((incident: any) => {
            const date = new Date(incident.start_time).toLocaleDateString("ro-RO", {
                day: "2-digit", month: "2-digit",
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

    // ------------------------------------------------EXTRA FOR THE MAIN MAP-------------------------------------------

    router.get("/active_incidents", requireAuth, async (req: Request, res: Response) => {
        const { data: incidents, error: incError } = await supabase
            .from("incidents")
            .select("incident_id, status, start_time, end_time, priority, assigned_to, messages")
            .eq("status", 1)

        if (incError) {
            res.status(500).json({ message: incError.message })
            return
        }
        if (!incidents || incidents.length === 0) {
            return res.json([]);
        }

        const incidentIds = incidents.map(i => i.incident_id);

        //Get all links from incident_alarms
        const { data: incidentAlarms, error: iaError } = await supabase
            .from("incident_alarms")
            .select("incident_id, alarm_id")
            .in("incident_id", incidentIds)

        if (iaError) {
            res.status(500).json({ message: iaError.message })
            return
        }

        const alarmIds = incidentAlarms.map(ia => ia.alarm_id);

        //Get all associated alarms
        const { data: alarms, error: alarmError } = await supabase
            .from("alarms")
            .select("alarm_id, site, tehnologie, type, status")
            .in("alarm_id", alarmIds)

        if (alarmError) {
            res.status(500).json({ message: alarmError.message })
            return
        }

        // each incident receives an array of alarms
        const result = incidents.map(i => ({
            ...i,
            alarms: incidentAlarms
                .filter(ia => ia.incident_id === i.incident_id)
                .map(ia => alarms.find(a => a.alarm_id === ia.alarm_id))
                .filter(Boolean)
        }));

        res.json(result)
    })

    router.get("/standalone_alarms", requireAuth, async (req: Request, res: Response) => {
        try {
            // 1. Extract the IDs of all alarms that are part of active incidents
            const { data: incidentAlarms, error: iaError } = await supabase
                .from("incident_alarms")
                .select("alarm_id");

            if (iaError) throw iaError;

            // create a list of busy alarm IDs
            const busyAlarmIds = incidentAlarms.map(ia => ia.alarm_id);

            // 2. Extract active alarms that are NOT in the list above
            let query = supabase
                .from("alarms")
                .select("alarm_id, status, start_time, type, tehnologie, site")
                .eq("status", 1); // Doar alarme active

            // If we have alarms in incidents, we exclude them
            if (busyAlarmIds.length > 0) {
                query = query.not("alarm_id", "in", `(${busyAlarmIds.join(",")})`);
            }

            const { data: standaloneAlarms, error: alarmError } = await query;

            if (alarmError) throw alarmError;

            res.json(standaloneAlarms);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    });

    return router;
}



export default createMapRouter;