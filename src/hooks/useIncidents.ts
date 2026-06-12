import { useEffect, useState } from "react";

export interface Incident {
    incident_id: number;
    status: number;
    start_time: string;
    end_time: string | null;
    assigned_to: string | null;
    messages: string | null;
    priority: string;
}

const useIncidents = () => {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchIncidents = async () => {
            try {
                const token = localStorage.getItem("token");
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/incidents?status=1`, {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                    },
                });
                const data = await response.json();
                setIncidents(Array.isArray(data) ? data : []);
            } catch (err) {
                setError("Failed to fetch incidents");
            } finally {
                setLoading(false);
            }
        };

        fetchIncidents();
    }, []);

    return { incidents, loading, error };
};

export default useIncidents;