import { useEffect, useState } from "react";

export type SiteOption = {
    site_id: string;
};

// Fetches the list of sites available for filtering in the Statistics page
// Backend aliases site.id as site_id, so the frontend type stays consistent
const useSites = () => {
    const [sites, setSites] = useState<SiteOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSites = async () => {
            try {
                setLoading(true);
                const response = await fetch("http://localhost:3000/statistics/sites");

                if (!response.ok) {
                    throw new Error("Failed to fetch sites");
                }

                const result: SiteOption[] = await response.json();
                setSites(result);
            } catch (err: any) {
                setError(err.message ?? "Unknown error");
            } finally {
                setLoading(false);
            }
        };

        fetchSites();
    }, []);

    return { sites, loading, error };
};

export default useSites;