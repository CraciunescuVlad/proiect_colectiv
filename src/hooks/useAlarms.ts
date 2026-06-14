import { useEffect, useState } from "react";

export interface Alarm {
    alarm_id: number;
    status: number;
    start_time: string;
    resolved_time: string | null;
    tehnologie: string;
    type: { reason: string } | null;
    site: { city: string; address: string } | null;
}

const useAlarms = () => {
    const [alarms, setAlarms] = useState<Alarm[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAlarms = async () => {
            try {
                const token = localStorage.getItem("token");
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/alarms`, {
                    headers: { "Authorization": `Bearer ${token}` },
                });
                const data = await response.json();
                setAlarms(Array.isArray(data) ? data : []);
            } catch (err) {
                setError("Failed to fetch alarms");
            } finally {
                setLoading(false);
            }
        };
        fetchAlarms();
    }, []);

    return { alarms, loading, error };
};

export default useAlarms;