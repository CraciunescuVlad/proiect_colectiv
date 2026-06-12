import { useEffect, useState } from "react";
import { authHeaders } from "../lib/apiHeaders";

export type KpiMetric = {
    value: number;
    changePercent: number;
};

export type OverviewKpis = {
    alarmsTotal: KpiMetric;
    alarmsResolved: KpiMetric;
    incidentsTotal: KpiMetric;
    incidentsResolved: KpiMetric;
};

// Fetches the 4 overview KPIs for the Statistics page header
// Each KPI carries a period-over-period percentage change
const useOverviewKpis = (from?: Date, to?: Date, siteIds?: string[]) => {
    const [kpis, setKpis] = useState<OverviewKpis | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

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
                if (from && to) {
                    params.append("from", formatDate(from));
                    params.append("to", formatDate(to));
                }
                if (siteIds && siteIds.length > 0) {
                    params.append("siteId", siteIds.join(","));
                }

                let url = `${import.meta.env.VITE_BACKEND_URL}/statistics/overview-kpis`;
                const qs = params.toString();
                if (qs !== "") {
                    url += `?${qs}`;
                }

                const response = await fetch(url, { headers: authHeaders() });

                if (!response.ok) {
                    throw new Error("Failed to fetch KPIs");
                }

                const result: OverviewKpis = await response.json();

                if (cancelled) {
                    return;
                }
                setKpis(result);
            } catch (err: any) {
                if (cancelled) {
                    return;
                }
                setError(err.message ?? "Unknown error");
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchKpis();

        return () => {
            cancelled = true;
        };
    }, [from?.getTime(), to?.getTime(), siteIds?.join(",")]);

    return { kpis, loading, error };
};

export default useOverviewKpis;