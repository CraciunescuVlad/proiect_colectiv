import { useEffect, useState } from "react";

type IncidentChartPoint = {
    date: string;
    value: number;
};

// Fetches the incidents chart data for a given date range
// If no range is provided, the backend defaults to the last 30 days
const useIncidentsChart = (from?: Date, to?: Date) => {
    const [data, setData] = useState<IncidentChartPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                let url = "http://localhost:3000/statistics/incidents/chart";
                if (from && to) {
                    const fromStr = from.toISOString().split("T")[0];
                    const toStr = to.toISOString().split("T")[0];
                    url += `?from=${fromStr}&to=${toStr}`;
                }

                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error("Failed to fetch incidents chart");
                }

                const result: IncidentChartPoint[] = await response.json();
                setData(result);
            } catch (err: any) {
                setError(err.message ?? "Unknown error");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [from?.getTime(), to?.getTime()]);

    return { data, loading, error };
};

export default useIncidentsChart;