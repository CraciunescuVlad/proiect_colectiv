import { useEffect, useState } from "react";

interface User {
    id: string;
    email: string;
    role: string;
    mustChangePassword?: boolean;
}

const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedToken = localStorage.getItem("token");
        const userStr = localStorage.getItem("user");

        if (!storedToken || !userStr) {
            setUser(null);
            setToken(null);
            setLoading(false);
            return;
        }

        try {
            const payload = JSON.parse(atob(storedToken.split(".")[1]));
            const isExpired = payload.exp * 1000 < Date.now();

            if (isExpired) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                setUser(null);
                setToken(null);
            } else {
                setUser(JSON.parse(userStr));
                setToken(storedToken);
            }
        } catch {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            setUser(null);
            setToken(null);
        } finally {
            setLoading(false);
        }
    }, []);

    return { user, token, loading };
};

export default useAuth;