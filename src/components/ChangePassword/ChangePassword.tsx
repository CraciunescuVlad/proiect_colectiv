import { useEffect, useState } from "react";
import Radar from "../Radar/Radar";
import RadarBlips from "../Radar/RadarBlips";

const ChangePassword = () => {
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const flag = localStorage.getItem("mustChangePassword");
        if (!flag) window.location.href = "/home";
    }, []);

    const handleSubmit = async () => {
        setError("");

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("http://localhost:3000/auth/change-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({ newPassword }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.message ?? "Something went wrong.");
                return;
            }

            localStorage.removeItem("mustChangePassword");
            window.location.href = "/home";
        } catch {
            setError("Network error. Please try again.");
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

    return (
        <div className="flex h-screen bg-[#060010]">
            <div className="w-[40%] flex flex-col items-center justify-center px-12 border-r border-white/10">
                <div className="w-full max-w-sm">
                    <h1 className="text-white text-3xl font-bold mb-2">Set a new password</h1>
                    <p className="text-white/40 text-sm mb-8">
                        Your account was unlocked by an administrator. Choose a new password to continue.
                    </p>

                    <input
                        type="password"
                        placeholder="New password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="bg-white/10 text-white placeholder-white/30 border border-white/20 rounded-lg px-4 py-2 w-full mb-3 outline-none focus:border-white/50"
                    />
                    <input
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                        className="bg-white/10 text-white placeholder-white/30 border border-white/20 rounded-lg px-4 py-2 w-full mb-4 outline-none focus:border-white/50"
                    />

                    {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="bg-white text-gray-900 font-medium px-6 py-2 rounded-lg w-full hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        {loading ? "Saving..." : "Set new password"}
                    </button>
                </div>
            </div>
            {rightPanel}
        </div>
    );
};

export default ChangePassword;
