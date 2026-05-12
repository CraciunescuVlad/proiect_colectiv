import { useEffect, useState } from "react";

interface User {
    id: string;
    email: string;
    role: string;
}

const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("token");
        const userStr = localStorage.getItem("user");

        if (!token || !userStr) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            const isExpired = payload.exp * 1000 < Date.now();

            if (isExpired) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                setUser(null);
            } else {
                setUser(JSON.parse(userStr));
            }
        } catch {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    return { user, loading };
};

export default useAuth;