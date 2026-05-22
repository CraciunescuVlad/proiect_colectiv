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
 * Given a date range, returns the immediately-preceding range of equal length.
 * Used to compute period-over-period KPI deltas.
 *
 * @param startDate The start of the current range
 * @param endDate The end of the current range
 * @return The start and end of the previous range of the same duration
 */
export const getPreviousRange = (
    startDate: Date,
    endDate: Date
): { prevStart: Date; prevEnd: Date } => {
    const durationMs = endDate.getTime() - startDate.getTime();
    const prevEnd = new Date(startDate.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);
    return { prevStart, prevEnd };
};
/**
 * Parses the optional 'siteId' query param into a list of trimmed strings.
 * Accepts a single value (e.g. "A123") or a comma-separated list (e.g. "A123,B456").
 * Returns null when missing or blank so callers can skip site filtering entirely.
 *
 * @param raw The raw query param value
 * @return The list of site ids, or null if not provided
 */
export const parseSiteIds = (raw: any): string[] | null => {
    if (typeof raw !== "string" || raw.trim() === "") {
        return null;
    }
    const ids = raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "");
    if (ids.length === 0) {
        return null;
    }
    return ids;
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

export type Granularity = "day" | "week" | "month";

/**
 * Parses the optional 'granularity' query param into "day", "week", or "month".
 * Defaults to "day" when missing or invalid.
 *
 * @param raw The raw query param value
 * @return The resolved granularity
 */
export const parseGranularity = (raw: any): Granularity => {
    if (raw === "week" || raw === "month") {
        return raw;
    }
    return "day";
};

/**
 * Returns the Monday of the ISO week containing the given date, at local midnight.
 *
 * @param d The reference date
 * @return The start of that week
 */
const startOfWeek = (d: Date): Date => {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    const day = out.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    out.setDate(out.getDate() + diff);
    return out;
};

/**
 * Returns the first day of the month containing the given date, at local midnight.
 *
 * @param d The reference date
 * @return The start of that month
 */
const startOfMonth = (d: Date): Date => {
    const out = new Date(d.getFullYear(), d.getMonth(), 1);
    out.setHours(0, 0, 0, 0);
    return out;
};

/**
 * Formats a date as "DD MMM" in Romanian locale, e.g. "19 apr".
 *
 * @param d The date to format
 * @return The formatted short label
 */
const formatShort = (d: Date): string => {
    return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short" });
};

/**
 * Computes the bucket label for a given date under the requested granularity.
 * For week and month buckets, the label is clamped to the requested range, so the
 * first and last buckets show their actual partial span (e.g. "19 apr - 30 apr").
 *
 * @param d The date being bucketed
 * @param granularity The bucket size
 * @param rangeStart The start of the requested range (used to clamp partial buckets)
 * @param rangeEnd The end of the requested range (used to clamp partial buckets)
 * @return The label that should be used as the x-axis key for that bucket
 */
export const bucketLabel = (
    d: Date,
    granularity: Granularity,
    rangeStart: Date,
    rangeEnd: Date
): string => {
    if (granularity === "day") {
        return formatDayLabel(d);
    }

    const rangeStartDay = new Date(rangeStart);
    rangeStartDay.setHours(0, 0, 0, 0);
    const rangeEndDay = new Date(rangeEnd);
    rangeEndDay.setHours(0, 0, 0, 0);

    let bucketStart: Date;
    let bucketEnd: Date;
    if (granularity === "week") {
        bucketStart = startOfWeek(d);
        bucketEnd = new Date(bucketStart);
        bucketEnd.setDate(bucketEnd.getDate() + 6);
    } else {
        bucketStart = startOfMonth(d);
        bucketEnd = new Date(bucketStart.getFullYear(), bucketStart.getMonth() + 1, 0);
        bucketEnd.setHours(0, 0, 0, 0);
    }

    const effectiveStart = bucketStart < rangeStartDay ? rangeStartDay : bucketStart;
    const effectiveEnd = bucketEnd > rangeEndDay ? rangeEndDay : bucketEnd;

    return `${formatShort(effectiveStart)} - ${formatShort(effectiveEnd)}`;
};

/**
 * Iterates bucket by bucket from startDate to endDate (inclusive), invoking the callback
 * with each bucket's label exactly once. Bucket size is controlled by 'granularity'.
 *
 * @param startDate The first day to include
 * @param endDate The last day to include
 * @param granularity The bucket size (day, week, or month)
 * @param callback Function invoked once per bucket with the formatted label
 */
export const forEachBucket = (
    startDate: Date,
    endDate: Date,
    granularity: Granularity,
    callback: (label: string) => void
): void => {
    if (granularity === "day") {
        forEachDay(startDate, endDate, callback);
        return;
    }

    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);
    const lastDay = new Date(endDate);
    lastDay.setHours(0, 0, 0, 0);

    const seen = new Set<string>();
    while (cursor <= lastDay) {
        const label = bucketLabel(cursor, granularity, startDate, endDate);
        if (!seen.has(label)) {
            seen.add(label);
            callback(label);
        }
        cursor.setDate(cursor.getDate() + 1);
    }
};