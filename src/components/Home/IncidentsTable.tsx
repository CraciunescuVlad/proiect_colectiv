import { useEffect, useState } from "react";
import useIncidents from "../../hooks/useIncidents";

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
                const res = await fetch(`http://localhost:3000/users/${userId}`);
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

const IncidentsTable = () => {
    const { incidents, loading, error } = useIncidents();

    return (
        <div className="border border-white/10 rounded-2xl overflow-hidden mt-6">
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
            <div className="p-2">
                {loading && (
                    <p className="text-white/40 text-sm px-4 py-3">Loading incidents...</p>
                )}
                {error && (
                    <p className="text-red-400 text-sm px-4 py-3">{error}</p>
                )}
                {!loading && !error && incidents.length === 0 && (
                    <p className="text-white/40 text-sm px-4 py-3">No active incidents</p>
                )}
                {!loading && !error && incidents.map((incident) => {
                    const priority = priorityColors[incident.priority] ?? priorityColors["Warning"];
                    return (
                        <div
                            key={incident.incident_id}
                            className="grid grid-cols-5 items-center px-4 py-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
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
                            <span className="text-white/40 text-xs truncate">
                                {incident.messages ?? "—"}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default IncidentsTable;