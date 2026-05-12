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
                const response = await fetch("http://localhost:3000/incidents?status=1");
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