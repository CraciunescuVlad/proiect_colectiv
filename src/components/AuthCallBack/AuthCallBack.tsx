import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AuthCallback = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");

        if (token) {
            localStorage.setItem("token", token);
            navigate("/home");
        } else {
            navigate("/login");
        }
    }, []);

    return (
        <div className="flex items-center justify-center h-screen bg-[#060010]">
            <p className="text-white/50 text-sm">Logging you in...</p>
        </div>
    );
};

export default AuthCallback;