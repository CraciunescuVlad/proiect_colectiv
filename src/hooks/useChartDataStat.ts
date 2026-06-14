import { useEffect, useState } from "react";
import { authHeaders } from "../lib/apiHeaders";

type ChartPoint = {
    date: string;
    value: number;
};

// Generic chart data hook used by LineChartCard
// Builds a URL with optional date range, site filter, and assignee filter
// Cancels stale responses when params change rapidly to avoid race conditions
const useChartData = (endpoint: string, from?: Date, to?: Date, siteIds?: string[], assignedTo?: string | null, granularity: "day" | "week" | "month" = "day") => {
    const [data, setData] = useState<ChartPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Tracks whether this effect is still the active one; if a newer effect runs,
        // the previous one's response is discarded to avoid stale data overwriting fresh data
        let cancelled = false;

        const fetchData = async () => {
            try {
                setLoading(true);

                const formatDate = (d: Date) => {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, "0");
                    const day = String(d.getDate()).padStart(2, "0");
                    return `${year}-${month}-${day}`;
                };

                const params = new URLSearchParams();
                if (from && to) {
                    params.append("from", formatDate(from));
                    params.append("to", formatDate(to));
                }
                if (siteIds && siteIds.length > 0) {
                    params.append("siteId", siteIds.join(","));
                }
                if (assignedTo !== null && assignedTo !== undefined && assignedTo !== "") {
                    params.append("assignedTo", assignedTo);
                }

                if (granularity !== "day") {
                    params.append("granularity", granularity);
                }

                let url = `${import.meta.env.VITE_BACKEND_URL}/statistics/${endpoint}`;
                const qs = params.toString();
                if (qs !== "") {
                    url += `?${qs}`;
                }

                const response = await fetch(url, { headers: authHeaders() });

                if (!response.ok) {
                    throw new Error("Failed to fetch chart data");
                }

                const result: ChartPoint[] = await response.json();

                if (cancelled) {
                    return;
                }
                setData(result);
            } catch (err: any) {
                if (cancelled) {
                    return;
                }
                setError(err.message ?? "Unknown error");
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchData();

        return () => {
            cancelled = true;
        };
    }, [endpoint, from?.getTime(), to?.getTime(), siteIds?.join(","), assignedTo, granularity]);

    return { data, loading, error };
};

export default useChartData;