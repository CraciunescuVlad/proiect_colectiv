import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import useAuth from "../hooks/useAuth";

interface UserContextType {
    user: { id: string; email: string; role: string } | null;
    token: string | null;
    loading: boolean;
}

const UserContext = createContext<UserContextType>({ user: null, token: null, loading: true });

export const UserProvider = ({ children }: { children: ReactNode }) => {
    const { user, token, loading } = useAuth();
    return (
        <UserContext.Provider value={{ user, token, loading }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => useContext(UserContext);