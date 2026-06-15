import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, loading } = useAuth();

    if (loading) return (
        <div className="flex items-center justify-center h-screen bg-[#060010]">
            <p className="text-white/40 text-sm">Loading...</p>
        </div>
    );

    if (!user) return <Navigate to="/login" replace />;

    if (user.mustChangePassword) return <Navigate to="/change-password" replace />;

    return <>{children}</>;
};

export default ProtectedRoute;