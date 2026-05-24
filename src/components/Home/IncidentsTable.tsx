import { useEffect, useState } from "react";
import useIncidents from "../../hooks/useIncidents";
import { useUser } from "../../context/UserContext";
import { Pencil, Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const priorityColors: Record<string, { text: string; bg: string; border: string }> = {
    Critical: { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20" },
    Major:    { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
    Minor:    { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
    Warning:  { text: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
};

const AssignedEmail = ({ userId }: { userId: string }) => {
    const [email, setEmail] = useState<string | null>(null);

    useEffect(() => {
        const fetch_user = async () => {
            try {
                const token = localStorage.getItem("token");
                const res = await fetch(`http://localhost:3000/users/${userId}`, {
                    headers: { "Authorization": `Bearer ${token}` },
                });
                const data = await res.json();
                setEmail(data.email ?? null);
            } catch {
                setEmail(null);
            }
        };
        fetch_user();
    }, [userId]);

    return <span className="text-white/70">{email ?? userId}</span>;
};

const MessageCell = ({ incidentId, initialMessage }: { incidentId: number; initialMessage: string | null }) => {
    const { user } = useUser();
    const [editing, setEditing] = useState(false);
    const [message, setMessage] = useState(initialMessage ?? "");
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch(`http://localhost:3000/incidents/${incidentId}/message`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({ messages: message }),
            });
            setEditing(false);
        } catch (err) {
            console.error("Failed to update message", err);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setMessage(initialMessage ?? "");
        setEditing(false);
    };

    if (user?.role !== "admin") {
        return <span className="text-white/40 text-xs">{message || "—"}</span>;
    }

    if (editing) {
        return (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="bg-white/10 text-white text-xs border border-white/20 rounded px-2 py-1 outline-none focus:border-white/50 w-full"
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleSave();
                        if (e.key === "Escape") handleCancel();
                    }}
                />
                <button onClick={(e) => { e.stopPropagation(); handleSave(); }} disabled={saving} className="text-green-400 hover:text-green-300 transition-colors shrink-0">
                    <Check size={14} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleCancel(); }} className="text-white/40 hover:text-white transition-colors shrink-0">
                    <X size={14} />
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 group" onClick={(e) => e.stopPropagation()}>
            <span className="text-white/40 text-xs">{message || "—"}</span>
            <button
                onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                className="text-white/20 hover:text-white/60 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
            >
                <Pencil size={12} />
            </button>
        </div>
    );
};

const IncidentsTable = () => {
    const { incidents, loading, error } = useIncidents();
    const navigate = useNavigate();

    return (
        <div className="border border-white/10 rounded-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                <h2 className="text-white text-sm font-semibold">Active Incidents</h2>
                <span className="text-white/30 text-xs">{incidents.length} total</span>
            </div>

            {/* Column labels */}
            <div className="grid grid-cols-5 px-5 py-2 border-b border-white/5">
                <span className="text-white/30 text-xs">ID</span>
                <span className="text-white/30 text-xs">Priority</span>
                <span className="text-white/30 text-xs">Start Time</span>
                <span className="text-white/30 text-xs">Assigned To</span>
                <span className="text-white/30 text-xs">Message</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-white/5">
                {loading && (
                    <p className="text-white/40 text-sm px-5 py-4">Loading incidents...</p>
                )}
                {error && (
                    <p className="text-red-400 text-sm px-5 py-4">{error}</p>
                )}
                {!loading && !error && incidents.length === 0 && (
                    <p className="text-white/40 text-sm px-5 py-4">No active incidents</p>
                )}
                {!loading && !error && incidents.map((incident) => {
                    const priority = priorityColors[incident.priority] ?? priorityColors["Warning"];
                    return (
                        <div
                            key={incident.incident_id}
                            onClick={() => navigate(`/incident/${incident.incident_id}`)}
                            className="grid grid-cols-5 items-center px-5 py-3 hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            <span className="text-white/70 text-sm font-mono">INC{incident.incident_id}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border w-fit ${priority.bg} ${priority.text} ${priority.border}`}>
                                {incident.priority}
                            </span>
                            <span className="text-white/50 text-xs">
                                {new Date(incident.start_time).toLocaleString()}
                            </span>
                            <span className="text-xs">
                                {incident.assigned_to
                                    ? <AssignedEmail userId={incident.assigned_to} />
                                    : <span className="text-white/30">Unassigned</span>
                                }
                            </span>
                            <MessageCell
                                incidentId={incident.incident_id}
                                initialMessage={incident.messages}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default IncidentsTable;