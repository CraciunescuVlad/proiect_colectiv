import { useState } from "react";
import { useNavigate } from "react-router-dom";

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleLogin = async () => {
        try {
            const response = await fetch("http://localhost:3000/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message);
                return;
            }

            localStorage.setItem("token", data.token);
            navigate("/home");
        } catch (err) {
            setError("Something went wrong. Try again.");
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#060010]">
            <h1 className="text-white text-3xl font-bold mb-8">Welcome back</h1>

            <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/10 text-white placeholder-white/30 border border-white/20 rounded-lg px-4 py-2 w-72 mb-3 outline-none focus:border-white/50"
            />
            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/10 text-white placeholder-white/30 border border-white/20 rounded-lg px-4 py-2 w-72 mb-4 outline-none focus:border-white/50"
            />

            {error && (
                <p className="text-red-400 text-sm mb-4">{error}</p>
            )}

            <button
                onClick={handleLogin}
                className="bg-white text-gray-900 font-medium px-6 py-2 rounded-lg w-72 hover:bg-gray-100 transition-colors"
            >
                Login
            </button>
        </div>
    );
};

export default Login;