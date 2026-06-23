import { useEffect, useState } from "react";
import useAuth from "./useAuth";

export type ProfileOption = {
    id: string;
    email: string;
};

/**
 * Fetches the list of viewer profiles available for filtering in the Statistics page
 * Endpoint is admin-only on the backend, so we always send the auth token
 */
const useProfiles = () => {
    const { token, user, loading: authLoading } = useAuth();
    const [profiles, setProfiles] = useState<ProfileOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading) {
            return;
        }

        if (!token || user?.role !== "admin") {
            setProfiles([]);
            setLoading(false);
            return;
        }

        const fetchProfiles = async () => {
            try {
                setLoading(true);
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/statistics/profiles`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch profiles");
                }

                const result: ProfileOption[] = await response.json();
                setProfiles(result);
            } catch (err: any) {
                setError(err.message ?? "Unknown error");
            } finally {
                setLoading(false);
            }
        };

        fetchProfiles();
    }, [token, user?.role, authLoading]);

    return { profiles, loading, error };
};

export default useProfiles;