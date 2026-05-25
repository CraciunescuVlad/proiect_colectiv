import { useEffect, useState } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import type { SelectedSite } from "./MapPage";
import type { Alarm } from "./MapPage";
import SiteChart from "./SiteChart";
import { useUser } from "../../context/UserContext.tsx";

const technologyColors: Record<string, { text: string; bg: string; border: string }> = {
    "2G": { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20" },
    "3G": { text: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
    "4G": { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
    "5G": { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20" },
};

const severityColors: Record<number, { text: string; bg: string; border: string; label: string }> = {
    1: { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20",  label: "Low" },
    2: { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", label: "Medium" },
    3: { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", label: "High" },
    4: { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20",    label: "Critical" },
};

interface AlarmType {
    id: string;
    reason: string;
    severity: number;
}

const AlarmCard = ({ alarm }: { alarm: Alarm }) => {
    const [expanded, setExpanded] = useState(false);
    const [alarmType, setAlarmType] = useState<AlarmType | null>(null);
    const [loading, setLoading] = useState(false);

    const colors = technologyColors[alarm.tehnologie] ?? {
        text: "text-purple-400",
        bg: "bg-purple-500/10",
        border: "border-purple-500/20",
    };

    const handleExpand = async () => {
        if (!expanded && !alarmType) {
            setLoading(true);
            try {
                const res = await fetch(`http://localhost:3000/map/alarm-type/${alarm.type}`);
                const data = await res.json();
                setAlarmType(data);
            } catch (err) {
                console.error("Failed to fetch alarm type", err);
            } finally {
                setLoading(false);
            }
        }
        setExpanded(!expanded);
    };

    const severity = alarmType ? severityColors[alarmType.severity] ?? severityColors[1] : null;

    return (
        <div className={`border rounded-lg overflow-hidden transition-all duration-200 ${colors.border} ${colors.bg}`}>
            <div
                className="flex items-center justify-between p-3 cursor-pointer hover:brightness-110 transition-all"
                onClick={handleExpand}
            >
                <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
                        {alarm.tehnologie} · {alarm.type}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-white/30 text-xs">
                        {new Date(alarm.start_time).toLocaleDateString()}
                    </span>
                    {expanded
                        ? <ChevronUp size={14} className="text-white/40" />
                        : <ChevronDown size={14} className="text-white/40" />
                    }
                </div>
            </div>

            {expanded && (
                <div className="px-3 pb-3 border-t border-white/10 pt-3 flex flex-col gap-2">
                    {loading ? (
                        <p className="text-white/40 text-xs">Loading details...</p>
                    ) : alarmType ? (
                        <>
                            {severity && (
                                <div className="flex items-center justify-between">
                                    <span className="text-white/40 text-xs">Severity</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${severity.bg} ${severity.text} ${severity.border}`}>
                                        {severity.label}
                                    </span>
                                </div>
                            )}
                            {alarmType.reason && (
                                <div>
                                    <span className="text-white/40 text-xs">Reason</span>
                                    <p className="text-white/70 text-xs mt-1 leading-relaxed">{alarmType.reason}</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-white/40 text-xs">No details available</p>
                    )}
                </div>
            )}
        </div>
    );
};

const SiteDetailsSidebar = ({
                                selectedSite,
                                onClose,
                            }: {
    selectedSite: SelectedSite;
    onClose: () => void;
}) => {
    const { site, incident } = selectedSite;
    const [visible, setVisible] = useState(false);
    const [alarms, setAlarms] = useState<Alarm[]>([]);
    const [loadingAlarms, setLoadingAlarms] = useState(true);
    const { user } = useUser();
    const [assigning, setAssigning] = useState(false);
    const [assigned, setAssigned] = useState<string | null>(incident?.assigned_to ?? null);
    const [assignedEmail, setAssignedEmail] = useState<string | null>(null);
    const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>("");

    const handleAssign = async () => {
        if (!incident || !user || !selectedUserId) return;
        setAssigning(true);
        try {
            const res = await fetch(`http://localhost:3000/incidents/${incident.incident_id}/assign`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({ assigned_to: selectedUserId }),
            });
            const data = await res.json();
            setAssigned(data.assigned_to);
        } catch (err) {
            console.error("Failed to assign", err);
        } finally {
            setAssigning(false);
        }
    };

    useEffect(() => {
        if (user?.role !== "admin" || !incident) return;
        fetch("http://localhost:3000/users", {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
        })
            .then(r => r.json())
            .then(data => {
                setUsers(Array.isArray(data) ? data : []);
                setSelectedUserId(assigned ?? user.id);
            })
            .catch(() => setUsers([]));
    }, [user, incident]);

    useEffect(() => {
        const timer = setTimeout(() => setVisible(true), 10);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const fetchAlarms = async () => {
            setLoadingAlarms(true);
            try {
                const res = await fetch(`http://localhost:3000/map/sites/${site.id}/alarms`);
                const data = await res.json();
                setAlarms(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Failed to fetch alarms", err);
                setAlarms([]);
            } finally {
                setLoadingAlarms(false);
            }
        };
        fetchAlarms();
    }, [site.id]);

    useEffect(() => {
        if (!assigned) return;
        const fetchAssignedUser = async () => {
            try {
                const res = await fetch(`http://localhost:3000/users/${assigned}`);
                const data = await res.json();
                setAssignedEmail(data.email ?? null);
            } catch {
                setAssignedEmail(null);
            }
        };
        fetchAssignedUser();
    }, [assigned]);

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 300);
    };

    return (
        <div
            className={`w-96 bg-[#0a0015]/95 backdrop-blur-sm border-l border-white/10 z-50 flex flex-col shrink-0
                transition-transform duration-300 ease-in-out
                ${visible ? "translate-x-0" : "translate-x-full"}`}
            style={{ height: "100%", maxHeight: "100%" }}
        >
            {/* Header — fixed, never scrolls */}
            <div className="flex items-start justify-between p-5 border-b border-white/10 shrink-0">
                <div>
                    <h2 className="text-white font-semibold text-base">{site.city}</h2>
                    <p className="text-white/40 text-xs mt-1">{site.address}</p>
                    <p className="text-white/30 text-xs mt-0.5">ID: {site.id}</p>
                </div>
                <button onClick={handleClose} className="text-white/40 hover:text-white transition-colors mt-0.5">
                    <X className="cursor-pointer" size={18} />
                </button>
            </div>

            {/* Content — scrollable */}
            <div
                className="p-5 flex flex-col gap-5 overflow-y-auto"
                style={{ flex: "1 1 0", minHeight: 0 }}
            >
                {/* Incident */}
                {incident ? (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                            <span className="text-white text-sm font-medium">Active Incident</span>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-white/50 text-xs">Priority</span>
                                <span className="text-red-400 text-xs font-medium">{incident.priority}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-white/50 text-xs">Status</span>
                                <span className="text-red-400 text-xs font-medium">
                                    {incident.status === 1 ? "Active" : "Resolved"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-white/50 text-xs">Start time</span>
                                <span className="text-white/70 text-xs">
                                    {new Date(incident.start_time).toLocaleString()}
                                </span>
                            </div>

                            {/* Assign section */}
                            <div className="mt-3 pt-3 border-t border-white/10">
                                {user?.role === "admin" ? (
                                    <div className="flex flex-col gap-2">
                                        {assigned && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-white/50 text-xs">Assigned to</span>
                                                <span className="text-green-400 text-xs">
                                                    {assigned === user?.id ? `You (${user.email})` : assignedEmail ?? assigned}
                                                </span>
                                            </div>
                                        )}
                                        <select
                                            value={selectedUserId}
                                            onChange={e => setSelectedUserId(e.target.value)}
                                            className="w-full py-2 px-3 bg-white/5 border border-white/10 text-white/70 text-xs rounded-lg focus:outline-none focus:border-white/30"
                                        >
                                            <option value="" disabled>Select a user...</option>
                                            {users.map(u => (
                                                <option key={u.id} value={u.id} style={{ background: "#0a0015" }}>
                                                    {u.email}{u.id === user.id ? " (you)" : ""}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={handleAssign}
                                            disabled={assigning || !selectedUserId}
                                            className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {assigning ? "Assigning..." : assigned ? "Reassign" : "Assign"}
                                        </button>
                                    </div>
                                ) : assigned ? (
                                    <div className="flex items-center justify-between">
                                        <span className="text-white/50 text-xs">Assigned to</span>
                                        <span className="text-green-400 text-xs">
                                            {assigned === user?.id ? `You (${user?.email})` : assignedEmail ?? assigned}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-white/30 text-xs">No one assigned yet</span>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                        <span className="text-white/40 text-sm">No active incident</span>
                    </div>
                )}

                {/* All active alarms */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                        <span className="text-white text-sm font-medium">
                            Active Alarms {!loadingAlarms && `(${alarms.length})`}
                        </span>
                    </div>
                    {loadingAlarms ? (
                        <p className="text-white/40 text-xs">Loading alarms...</p>
                    ) : alarms.length === 0 ? (
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                            <span className="text-white/40 text-sm">No active alarms</span>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {alarms.map((alarm) => (
                                <AlarmCard key={alarm.alarm_id} alarm={alarm} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Charts */}
                {/*<div className="border border-white/10 rounded-xl overflow-hidden">*/}
                {/*    <div className="px-4 py-3 border-b border-white/10">*/}
                {/*        <p className="text-white text-sm font-medium">Last 30 Days</p>*/}
                {/*    </div>*/}
                {/*    <div className="p-4 flex flex-col gap-5">*/}
                {/*        <div>*/}
                {/*            <div className="flex items-center gap-2 mb-2">*/}
                {/*                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />*/}
                {/*                <p className="text-white/50 text-xs">Alarms</p>*/}
                {/*            </div>*/}
                {/*            <SiteChart siteId={site.id} type="alarms" color="#818cf8" />*/}
                {/*        </div>*/}
                {/*        <div className="border-t border-white/10 pt-4">*/}
                {/*            <div className="flex items-center gap-2 mb-2">*/}
                {/*                <span className="w-1.5 h-1.5 rounded-full bg-pink-400 inline-block" />*/}
                {/*                <p className="text-white/50 text-xs">Incidents</p>*/}
                {/*            </div>*/}
                {/*            <SiteChart siteId={site.id} type="incidents" color="#f472b6" />*/}
                {/*        </div>*/}
                {/*    </div>*/}
                {/*</div>*/}

            </div>
        </div>
    );
};

export default SiteDetailsSidebar;