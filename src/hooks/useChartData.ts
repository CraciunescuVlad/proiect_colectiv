import { useEffect, useState } from "react";

interface ChartPoint {
    date: string;
    value: number;
}

const useChartData = (type: "incidents" | "alarms") => {
    const [data, setData] = useState<ChartPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const endpoint = type === "alarms"
                    ? `${import.meta.env.VITE_BACKEND_URL}/dashboard/alarms/chart`
                    : `${import.meta.env.VITE_BACKEND_URL}/dashboard/incidents/chart`;
                const response = await fetch(endpoint);
                const json = await response.json();
                setData(json);
            } catch (err) {
                setError("Failed to fetch chart data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [type]);

    return { data, loading, error };
};

export default useChartData;