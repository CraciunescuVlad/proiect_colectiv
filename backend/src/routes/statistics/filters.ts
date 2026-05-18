import { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "./helpers";

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
            .order("alarm_id", { ascending: true })
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
            .order("id", { ascending: true })
            .range(rangeFrom, rangeTo)
    );
    if (error || !data) {
        return { incidentIds: [], error };
    }
    const unique = [...new Set(data.map(l => l.incident_id))];
    return { incidentIds: unique, error: null };
};

/**
 * Resolves the incident IDs assigned to a given user.
 *
 * @param supabase The Supabase client
 * @param assignedTo The user id to filter incidents by
 * @return The incident IDs assigned to that user, or an error
 */
const getIncidentIdsForAssignee = async (
    supabase: SupabaseClient,
    assignedTo: string
): Promise<{ incidentIds: number[]; error: any }> => {
    const { data, error } = await fetchAll<{ incident_id: number }>((rangeFrom, rangeTo) =>
        supabase
            .from("incidents")
            .select("incident_id")
            .eq("assigned_to", assignedTo)
            .order("incident_id", { ascending: true })
            .range(rangeFrom, rangeTo)
    );
    if (error || !data) {
        return { incidentIds: [], error };
    }
    return { incidentIds: data.map(i => i.incident_id), error: null };
};

/**
 * Resolves the incident filter for either a site or an assignee.
 * Filters are mutually exclusive: assignedTo takes priority when both are provided.
 * Returns null when neither filter is requested, so callers can skip the .in() clause entirely.
 * An empty array means the filter has no matching incidents and the caller should short-circuit.
 *
 * @param supabase The Supabase client
 * @param siteId The site id to filter by, or null
 * @param assignedTo The assignee user id to filter by, or null
 * @return The list of incident IDs to filter by, or null if no filter is needed
 */
export const resolveIncidentFilter = async (
    supabase: SupabaseClient,
    siteId: string | null,
    assignedTo: string | null
): Promise<{ incidentFilter: number[] | null; error: any }> => {
    if (assignedTo !== null) {
        const { incidentIds, error } = await getIncidentIdsForAssignee(supabase, assignedTo);
        if (error) {
            return { incidentFilter: null, error };
        }
        return { incidentFilter: incidentIds, error: null };
    }
    if (siteId !== null) {
        const { incidentIds, error } = await getIncidentIdsForSite(supabase, siteId);
        if (error) {
            return { incidentFilter: null, error };
        }
        return { incidentFilter: incidentIds, error: null };
    }
    return { incidentFilter: null, error: null };
};