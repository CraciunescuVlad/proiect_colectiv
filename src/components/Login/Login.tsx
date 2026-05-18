import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState((location.state as { email?: string })?.email ?? "");
    const [password, setPassword] = useState("");
    const [mfaCode, setMfaCode] = useState("");
    const [step, setStep] = useState<"login" | "mfa">("login");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        setError("");

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

            setStep("mfa");
        } catch {
            setError("Something went wrong. Try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyMfa = async () => {
        if (mfaCode.length !== 6) {
            setError("Please enter the 6-digit code.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await fetch("http://localhost:3000/auth/verify-mfa", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code: mfaCode }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message);
                return;
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            navigate("/home");
        } catch {
            setError("Something went wrong. Try again.");
        } finally {
            setLoading(false);
        }
    };

    const rightPanel = (
        <div className="w-[60%] flex flex-col items-center justify-center bg-[#0a0015] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-blue-900/20" />
            <div className="relative z-10 text-center px-12">
                <h2 className="text-white text-4xl font-bold mb-4">AlarmUP</h2>
                <p className="text-white/40 text-lg max-w-md">
                    Monitor and track telecom incidents across Romania in real time.
                </p>
            </div>
        </div>
    );

    if (step === "mfa") {
        return (
            <div className="flex h-screen bg-[#060010]">
                <div className="w-[40%] flex flex-col items-center justify-center px-12 border-r border-white/10">
                    <div className="w-full max-w-sm">
                        <h1 className="text-white text-3xl font-bold mb-2">Check your email</h1>
                        <p className="text-white/40 text-sm mb-8">
                            We sent a 6-digit code to <span className="text-white/70">{email}</span>
                        </p>

                        <input
                            type="text"
                            placeholder="000000"
                            value={mfaCode}
                            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            className="bg-white/10 text-white placeholder-white/30 border border-white/20 rounded-lg px-4 py-2 w-full mb-4 outline-none focus:border-white/50 text-center text-2xl tracking-widest"
                        />

                        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

                        <button
                            onClick={handleVerifyMfa}
                            disabled={loading}
                            className="bg-white text-gray-900 font-medium px-6 py-2 rounded-lg w-full hover:bg-gray-100 transition-colors disabled:opacity-50"
                        >
                            {loading ? "Verifying..." : "Verify"}
                        </button>

                        <p className="text-white/40 text-sm mt-4 text-center">
                            Didn't receive it?{" "}
                            <span
                                onClick={() => { setStep("login"); setError(""); setMfaCode(""); }}
                                className="text-white cursor-pointer hover:underline"
                            >
                                Try again
                            </span>
                        </p>
                    </div>
                </div>
                {rightPanel}
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#060010]">
            <div className="w-[40%] flex flex-col items-center justify-center px-12 border-r border-white/10">
                <div className="w-full max-w-sm">
                    <h1 className="text-white text-3xl font-bold mb-2">Welcome back</h1>
                    <p className="text-white/40 text-sm mb-8">Sign in to your account</p>

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
                        className="bg-white/10 text-white placeholder-white/30 border border-white/20 rounded-lg px-4 py-2 w-full mb-4 outline-none focus:border-white/50"
                    />

                    {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        className="bg-white text-gray-900 font-medium px-6 py-2 rounded-lg w-full hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        {loading ? "Sending code..." : "Login"}
                    </button>

                    <p className="text-white/40 text-sm mt-4 text-center">
                        Don't have an account?{" "}
                        <span
                            onClick={() => navigate("/signup")}
                            className="text-white cursor-pointer hover:underline"
                        >
                            Sign up
                        </span>
                    </p>
                </div>
            </div>
            {rightPanel}
        </div>
    );
};

export default Login;
