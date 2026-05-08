import { useEffect, useState } from "react";

type ChartPoint = {
    date: string;
    value: number;
};

// Fetches chart data from a given statistics endpoint with optional date range
const useChartData = (endpoint: string, from?: Date, to?: Date) => {
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

                let url = `http://localhost:3000/statistics/${endpoint}/chart`;
                if (from && to) {
                    url += `?from=${formatDate(from)}&to=${formatDate(to)}`;
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
    }, [endpoint, from?.getTime(), to?.getTime()]);

    return { data, loading, error };
};

export default useChartData;