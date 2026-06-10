import { useEffect, useState } from "react";
import { authHeaders } from "../lib/apiHeaders";

interface Stats {
    total: number;
    resolved: number;
    active: number;
    resolutionRate: string;
    avgResolveTime: string;
    totalIncidents: number;
    criticalCount: number;
}

const useStats = () => {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch("http://localhost:3000/dashboard/stats", { headers: authHeaders() });
                const data = await response.json();
                setStats(data);
            } catch (err) {
                setError("Failed to fetch stats");
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    return { stats, loading, error };
};

export default useStats;