import { useEffect, useState } from "react";

type SeverityChartPoint = {
    date: string;
    Low: number;
    Medium: number;
    High: number;
};

// Fetches alarms grouped by day and severity for a given date range
// Optionally filtered by site
const useAlarmsBySeverity = (from?: Date, to?: Date, siteId?: string | null) => {
    const [data, setData] = useState<SeverityChartPoint[]>([]);
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

                let url = "http://localhost:3000/statistics/alarms/chart-by-severity";
                const qs = params.toString();
                if (qs !== "") {
                    url += `?${qs}`;
                }

                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error("Failed to fetch alarms by severity");
                }

                const result: SeverityChartPoint[] = await response.json();
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

export default useAlarmsBySeverity;