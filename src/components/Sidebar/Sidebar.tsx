import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { BarChart2, Map, LogOut, LayoutDashboard, ShieldCheck } from "lucide-react";
import { useUser } from "../../context/UserContext";

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [expanded, setExpanded] = useState(false);
    const { user } = useUser();

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

    const navItems = [
        { label: "Dashboard", icon: <LayoutDashboard size={20} />, route: "/home" },
        { label: "Statistics", icon: <BarChart2 size={20} />, route: "/statistics" },
        { label: "Map", icon: <Map size={20} />, route: "/harta" },
        { label: "Admin Access", icon: <ShieldCheck size={20} />, route: "/admin-requests" },
    ];

    return (
        <div
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
            className={`flex flex-col justify-between h-screen bg-[#0a0015] border-r border-white/10 px-4 py-6 fixed left-0 top-0 z-50 transition-all duration-300 ease-in-out
            ${expanded ? "w-64" : "w-16"}`}
        >
            {/* Logo */}
            <div>
                <div className="mb-8 px-2 h-7 flex items-center overflow-hidden">
                    {expanded ? (
                        <h1 className="text-white font-bold text-xl tracking-tight whitespace-nowrap">AlarmUP</h1>
                    ) : (
                        <span className="text-white font-bold text-xl">M</span>
                    )}
                </div>

                {/* Nav items */}
                <nav className="flex flex-col gap-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.route;
                        return (
                            <button
                                key={item.label}
                                onClick={() => navigate(item.route)}
                                className={`flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left
                                  ${isActive
                                    ? "bg-white/10 text-white"
                                    : "text-white/50 hover:text-white hover:bg-white/5"
                                }`}
                            >
                                <span className="shrink-0">{item.icon}</span>
                                {expanded && (
                                    <span className="whitespace-nowrap overflow-hidden transition-all duration-300">
                                        {item.label}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Footer */}
            <div className={`flex items-center pt-4 border-t border-white/10 transition-all duration-300
                ${expanded ? "justify-between px-2" : "justify-center flex-col gap-3"}`}
            >
                <img
                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.email ?? "User"}`}
                    alt="Profile"
                    className="w-8 h-8 rounded-full bg-white/10 shrink-0"
                />
                {expanded && (
                    <span className="text-white/70 text-sm font-medium whitespace-nowrap truncate max-w-[120px]">
                        {user?.email ?? "User"}
                    </span>
                )}
                <button
                    onClick={handleLogout}
                    className="text-white/40 hover:text-red-400 transition-colors shrink-0"
                    title="Logout"
                >
                    <LogOut size={18} />
                </button>
            </div>
        </div>
    );
};

export default Sidebar;