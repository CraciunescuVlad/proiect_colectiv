import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Radar from "../Radar/Radar";
import RadarBlips from "../Radar/RadarBlips";
const Signup = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState<"signup" | "verify">("signup");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSignup = async () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.(ro|com)$/;
        if (!emailRegex.test(email)) {
            setError("Please enter a valid email address.");
            return;
        }
        if (password !== confirm) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        setError("");

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

            setStep("verify");
        } catch {
            setError("Something went wrong. Try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        if (otp.length < 6) {
            setError("Please enter the verification code.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await fetch("http://localhost:3000/auth/verify-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message);
                return;
            }

            navigate("/login", { state: { email } });
        } catch {
            setError("Something went wrong. Try again.");
        } finally {
            setLoading(false);
        }
    };

    const rightPanel = (
            <div className="w-[60%] flex flex-col items-center justify-center bg-[#0a0015] relative overflow-hidden">
                <div className="absolute inset-0">
                    <Radar color="#9f29ff" backgroundColor="#000000" />
                </div>
    
                <RadarBlips />
    
                <div className="relative z-10 text-center px-12 pointer-events-none">
                    <h2 className="text-white text-4xl font-bold mb-4">AlarmUP</h2>
    
                </div>
                <div className="absolute bottom-8 left-0 right-0 z-10 text-center px-12 pointer-events-none">
                    <p className="text-white/40 text-lg max-w-md mx-auto">
                        Monitor and track telecom incidents across Romania in real time.
                    </p>
                </div>
            </div>
        );
    

    if (step === "verify") {
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
                            placeholder="········"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.slice(0, 8))}
                            className="bg-white/10 text-white placeholder-white/30 border border-white/20 rounded-lg px-4 py-2 w-full mb-4 outline-none focus:border-white/50 text-center text-2xl tracking-widest"
                        />

                        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

                        <button
                            onClick={handleVerify}
                            disabled={loading}
                            className="bg-white text-gray-900 font-medium px-6 py-2 rounded-lg w-full hover:bg-gray-100 transition-colors disabled:opacity-50"
                        >
                            {loading ? "Verifying..." : "Verify Email"}
                        </button>

                        <p className="text-white/40 text-sm mt-4 text-center">
                            Wrong email?{" "}
                            <span
                                onClick={() => { setStep("signup"); setError(""); setOtp(""); }}
                                className="text-white cursor-pointer hover:underline"
                            >
                                Go back
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

                    <button
                        onClick={handleSignup}
                        disabled={loading}
                        className="bg-white text-gray-900 font-medium px-6 py-2 rounded-lg w-full hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        {loading ? "Sending code..." : "Create Account"}
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
            {rightPanel}
        </div>
    );
};

export default Signup;
