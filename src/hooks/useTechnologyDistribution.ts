import { useEffect, useState } from "react";

type PiePoint = {
    name: string;
    value: number;
};

// Fetches a name/value distribution from a given endpoint
const useTechnologyDistribution = (endpoint: string, from?: Date, to?: Date) => {
    const [data, setData] = useState<PiePoint[]>([]);
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

                let url = `http://localhost:3000/statistics/${endpoint}`;
                if (from && to) {
                    url += `?from=${formatDate(from)}&to=${formatDate(to)}`;
                }

                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error("Failed to fetch distribution");
                }

                const result: PiePoint[] = await response.json();
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

export default useTechnologyDistribution;