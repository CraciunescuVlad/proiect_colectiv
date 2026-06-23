import { useEffect, useState } from "react";
import { authHeaders } from "../lib/apiHeaders";

export type ViewerKpis = {
    avgResolutionMinutes: number;
    assignedCount: number;
    resolvedCount: number;
};

/**
 * Pulls the 3 viewer KPIs (avg resolution time, assigned count, resolved count) for a given profile and date range
 * @param assignedTo The viewer profile id to fetch KPIs for, or null to skip the request
 * @param from Optional start of the date range
 * @param to Optional end of the date range
 */
const useViewerKpis = (assignedTo: string | null, from?: Date, to?: Date) => {
    const [kpis, setKpis] = useState<ViewerKpis | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (assignedTo === null) {
            setKpis(null);
            return;
        }

        const fetchKpis = async () => {
            try {
                setLoading(true);

                const formatDate = (d: Date) => {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, "0");
                    const day = String(d.getDate()).padStart(2, "0");
                    return `${year}-${month}-${day}`;
                };

                const params = new URLSearchParams();
                params.append("assignedTo", assignedTo);
                if (from && to) {
                    params.append("from", formatDate(from));
                    params.append("to", formatDate(to));
                }

                const url = `${import.meta.env.VITE_BACKEND_URL}/statistics/incidents/kpis?${params.toString()}`;
                const response = await fetch(url, { headers: authHeaders() });

                if (!response.ok) {
                    throw new Error("Failed to fetch KPIs");
                }

                const result: ViewerKpis = await response.json();
                setKpis(result);
            } catch (err: any) {
                setError(err.message ?? "Unknown error");
            } finally {
                setLoading(false);
            }
        };

        fetchKpis();
    }, [assignedTo, from?.getTime(), to?.getTime()]);

    return { kpis, loading, error };
};

export default useViewerKpis;