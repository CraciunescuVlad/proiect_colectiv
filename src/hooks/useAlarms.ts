import { useEffect, useState } from "react";
import type { Alarm } from "../components/Map/MapPage.tsx";

const useAlarms = () => {
    const [alarms, setAlarms] = useState<Alarm[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAlarms = async () => {
            try {
                const response = await fetch("http://localhost:3000/alarms");
                const data = await response.json();
                setAlarms(data);
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