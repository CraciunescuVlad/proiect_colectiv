import { useEffect, useState } from "react";
import { authHeaders } from "../lib/apiHeaders";

type PiePoint = {
    name: string;
    value: number;
};

// Fetches a name/value distribution from a given endpoint
// Optionally filtered by site
const useTechnologyDistribution = (endpoint: string, from?: Date, to?: Date, siteIds?: string[] | null, assignedTo?: string | null) => {
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

                let url = `${import.meta.env.VITE_BACKEND_URL}/statistics/${endpoint}`;
                const qs = params.toString();
                if (qs !== "") {
                    url += `?${qs}`;
                }

                const response = await fetch(url, { headers: authHeaders() });

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
    }, [endpoint, from?.getTime(), to?.getTime(), siteIds?.join(","), assignedTo]);

    return { data, loading, error };
};

export default useTechnologyDistribution;