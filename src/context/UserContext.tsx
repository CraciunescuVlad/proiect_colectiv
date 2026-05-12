import { createContext, useContext, ReactNode } from "react";
import useAuth from "../hooks/useAuth";

interface UserContextType {
    user: { id: string; email: string; role: string } | null;
    loading: boolean;
}

const UserContext = createContext<UserContextType>({ user: null, loading: true });

export const UserProvider = ({ children }: { children: ReactNode }) => {
    const { user, loading } = useAuth();
    return (
        <UserContext.Provider value={{ user, loading }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => useContext(UserContext);