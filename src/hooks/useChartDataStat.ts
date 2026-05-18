import { useEffect, useState } from "react";

type ChartPoint = {
    date: string;
    value: number;
};

// Generic chart data hook used by LineChartCard
// Builds a URL with optional date range and site filter
const useChartData = (endpoint: string, from?: Date, to?: Date, siteId?: string | null, assignedTo?: string | null) => {
    const [data, setData] = useState<ChartPoint[]>([]);
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

                if (assignedTo !== null && assignedTo !== undefined && assignedTo !== "") {
    params.append("assignedTo", assignedTo);
}

                let url = `http://localhost:3000/statistics/${endpoint}`;
                const qs = params.toString();
                if (qs !== "") {
                    url += `?${qs}`;
                }

                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error("Failed to fetch chart data");
                }

                const result: ChartPoint[] = await response.json();
                setData(result);
            } catch (err: any) {
                setError(err.message ?? "Unknown error");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [endpoint, from?.getTime(), to?.getTime(), siteId, assignedTo]);

    return { data, loading, error };
};

export default useChartData;