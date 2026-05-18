/**
 * Paginates over Supabase results to bypass the default 1000-row limit.
 * Calls the builder repeatedly with sliding ranges until a short page is returned.
 *
 * @param buildQuery Callback that receives the current range bounds and returns a Supabase query
 * @return All rows aggregated across pages, or an error if any page fails
 */
export const fetchAll = async <T>(
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
export const parseSiteId = (raw: any): string | null => {
    if (typeof raw !== "string" || raw.trim() === "") {
        return null;
    }
    return raw.trim();
};

/**
 * Parses the optional 'assignedTo' query param into a trimmed string, or null if missing or blank.
 *
 * @param raw The raw query param value
 * @return The trimmed assigned_to user id, or null if not provided
 */
export const parseAssignedTo = (raw: any): string | null => {
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
export const parseDateRange = (rawFrom: any, rawTo: any): { startDate: Date; endDate: Date } => {
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
export const formatDayLabel = (d: Date): string => {
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
export const forEachDay = (
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