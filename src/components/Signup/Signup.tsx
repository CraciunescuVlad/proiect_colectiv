import { useState } from "react";
import { useNavigate } from "react-router-dom";



const Signup = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    
    const handleSignup = async () => {
            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.(ro|com)$/;
            if (!emailRegex.test(email)) {
                setError("Please enter a valid email address.");
                return;
            }

            if (password !== confirm) {
                setError("Passwords do not match.");
                return;
            }

        try {
            const response = await fetch("http://localhost:3000/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message);
                return;
            }

            setSuccess("Account created! Redirecting to login...");
            setError("");
            setTimeout(() => navigate("/login", { state: { email } }), 1000);
        } catch (err) {
            setError("Something went wrong. Try again.");
        }
    };

    return (
        <div className="flex h-screen bg-[#060010]">

            {/* Left side — 40% — signup form */}
            <div className="w-[40%] flex flex-col items-center justify-center px-12 border-r border-white/10">
                <div className="w-full max-w-sm">
                    <h1 className="text-white text-3xl font-bold mb-2">Create account</h1>
                    <p className="text-white/40 text-sm mb-8">Sign up to get started</p>

                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-white/10 text-white placeholder-white/30 border border-white/20 rounded-lg px-4 py-2 w-full mb-3 outline-none focus:border-white/50"
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-white/10 text-white placeholder-white/30 border border-white/20 rounded-lg px-4 py-2 w-full mb-3 outline-none focus:border-white/50"
                    />
                    <input
                        type="password"
                        placeholder="Confirm password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        className="bg-white/10 text-white placeholder-white/30 border border-white/20 rounded-lg px-4 py-2 w-full mb-4 outline-none focus:border-white/50"
                    />

                    {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
                    {success && <p className="text-green-400 text-sm mb-4">{success}</p>}

                    <button
                        onClick={handleSignup}
                        className="bg-white text-gray-900 font-medium px-6 py-2 rounded-lg w-full hover:bg-gray-100 transition-colors"
                    >
                        Create Account
                    </button>

                    <p className="text-white/40 text-sm mt-4 text-center">
                        Already have an account?{" "}
                        <span
                            onClick={() => navigate("/login")}
                            className="text-white cursor-pointer hover:underline"
                        >
                            Log in
                        </span>
                    </p>
                </div>
            </div>

            {/* Right side — 60% — decorative panel */}
            <div className="w-[60%] flex flex-col items-center justify-center bg-[#0a0015] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-blue-900/20" />
                <div className="relative z-10 text-center px-12">
                    <h2 className="text-white text-4xl font-bold mb-4">AlarmUP</h2>
                    <p className="text-white/40 text-lg max-w-md">
                        Monitor and track telecom incidents across Romania in real time.
                    </p>
                </div>
            </div>

        </div>
    );
};

export default Signup;