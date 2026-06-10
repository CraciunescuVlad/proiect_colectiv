import { useState } from "react";
import { useUser } from "../../context/UserContext";
import { ShieldCheck, Mail, KeyRound, Eye, EyeOff, Check, X } from "lucide-react";

interface PasswordFieldProps {
    label: string;
    name: string;
    value: string;
    show: boolean;
    onToggle: () => void;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const ProfilePage = () => {
    const { user } = useUser();

    const [form, setForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [status, setStatus] = useState<"success" | "error" | null>(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [loading, setLoading] = useState(false);

    const passwordRules = [
        { label: "At least 8 characters", valid: form.newPassword.length >= 8 },
        { label: "One uppercase letter", valid: /[A-Z]/.test(form.newPassword) },
        { label: "One number", valid: /[0-9]/.test(form.newPassword) },
        { label: "Passwords match", valid: form.newPassword === form.confirmPassword && form.confirmPassword !== "" },
    ];

    const allValid = passwordRules.every((r) => r.valid) && form.oldPassword !== "";

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setStatus(null);
    };

    const handleSubmit = async () => {
        if (!allValid) return;
        setLoading(true);
        setStatus(null);

        try {
            const token = localStorage.getItem("token");
            const res = await fetch("http://localhost:3000/users/change-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    oldPassword: form.oldPassword,
                    newPassword: form.newPassword,
                }),
            });

           // const data = await res.json();

            const data = await res.json();
            console.log("status:", res.status, "data:", data);
            if (!res.ok) {
                setErrorMsg(data.message || "Something went wrong.");
                setStatus("error");
            } else {
                setStatus("success");
                setForm({ oldPassword: "", newPassword: "", confirmPassword: "" });

                setTimeout(() => {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    window.location.href = "/login";
                }, 2000);
            }
        } catch {
            setErrorMsg("Something went wrong.");
            setStatus("error");
        } finally {
            setLoading(false);
        }

    };

    return (
        <div className="min-h-screen bg-[#0a0015] text-white flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md space-y-6">

                <div className="flex flex-col items-center gap-3">
                    <img
                        src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.email ?? "User"}`}
                        alt="Avatar"
                        className="w-20 h-20 rounded-full ring-2 ring-white/10"
                    />
                    <div className="text-center">
                        <p className="text-white font-semibold text-lg">{user?.email ?? "—"}</p>
                        <span className="inline-flex items-center gap-1.5 text-xs text-white/50 mt-1 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                            <ShieldCheck size={12} />
                            {user?.role ?? "user"}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                        <Mail size={16} className="text-white/40 shrink-0" />
                        <div>
                            <p className="text-xs text-white/40 mb-0.5">Email</p>
                            <p className="text-sm text-white font-medium">{user?.email ?? "—"}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                        <ShieldCheck size={16} className="text-white/40 shrink-0" />
                        <div>
                            <p className="text-xs text-white/40 mb-0.5">Role</p>
                            <p className="text-sm text-white font-medium capitalize">{user?.role ?? "—"}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs text-white/30 flex items-center gap-1.5">
                        <KeyRound size={11} /> Change password
                    </span>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                <div className="space-y-3">
                    <PasswordField
                        label="Current password"
                        name="oldPassword"
                        value={form.oldPassword}
                        show={showOld}
                        onToggle={() => setShowOld(!showOld)}
                        onChange={handleChange}
                    />
                    <PasswordField
                        label="New password"
                        name="newPassword"
                        value={form.newPassword}
                        show={showNew}
                        onToggle={() => setShowNew(!showNew)}
                        onChange={handleChange}
                    />
                    <PasswordField
                        label="Confirm new password"
                        name="confirmPassword"
                        value={form.confirmPassword}
                        show={showConfirm}
                        onToggle={() => setShowConfirm(!showConfirm)}
                        onChange={handleChange}
                    />

                    {form.newPassword !== "" && (
                        <ul className="space-y-1 pt-1">
                            {passwordRules.map((rule) => (
                                <li key={rule.label} className={`flex items-center gap-2 text-xs transition-colors ${rule.valid ? "text-emerald-400" : "text-white/30"}`}>
                                    {rule.valid ? <Check size={12} /> : <X size={12} />}
                                    {rule.label}
                                </li>
                            ))}
                        </ul>
                    )}

                    {status === "success" && (
                        <p className="text-emerald-400 text-sm flex items-center gap-2">
                            <Check size={14} /> Password changed successfully. Redirecting to login...
                        </p>
                    )}
                    {status === "error" && (
                        <p className="text-red-400 text-sm flex items-center gap-2">
                            <X size={14} /> {errorMsg}
                        </p>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={!allValid || loading}
                        className="w-full py-2.5 rounded-xl text-sm font-medium transition-all
                            bg-white text-[#0a0015] hover:bg-white/90
                            disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {loading ? "Saving..." : "Save password"}
                    </button>
                </div>
            </div>
        </div>
    );
};

const PasswordField = ({ label, name, value, show, onToggle, onChange }: PasswordFieldProps) => (
    <div className="relative">
        <label className="block text-xs text-white/40 mb-1.5">{label}</label>
        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus-within:border-white/30 transition-colors">
            <input
                type={show ? "text" : "password"}
                name={name}
                value={value}
                onChange={onChange}
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/20"
                placeholder="••••••••"
            />
            <button type="button" onClick={onToggle} className="text-white/30 hover:text-white/60 transition-colors ml-2">
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
        </div>
    </div>
);

export default ProfilePage;