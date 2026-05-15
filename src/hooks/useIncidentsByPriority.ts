import { useEffect, useState } from "react";

type PriorityChartPoint = {
    date: string;
    warning: number;
    minor: number;
    major: number;
    critical: number;
};

// Fetches incidents grouped by day and priority for a given date range
// Optionally filtered by site
const useIncidentsByPriority = (from?: Date, to?: Date, siteId?: string | null) => {
    const [data, setData] = useState<PriorityChartPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
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
                if (siteId !== null && siteId !== undefined && siteId !== "") {
                    params.append("siteId", siteId);
                }

                let url = "http://localhost:3000/statistics/incidents/chart-by-priority";
                const qs = params.toString();
                if (qs !== "") {
                    url += `?${qs}`;
                }

                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error("Failed to fetch incidents by priority");
                }

                const result: PriorityChartPoint[] = await response.json();
                setData(result);
            } catch (err: any) {
                setError(err.message ?? "Unknown error");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [from?.getTime(), to?.getTime(), siteId]);

    return { data, loading, error };
};

export default useIncidentsByPriority;