import { useEffect, useState } from "react";
import useIncidents from "../../hooks/useIncidents";
import useAlarms from "../../hooks/useAlarms";
import { useUser } from "../../context/UserContext";
import { Pencil, Check, X, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Tab = "incidents" | "alarms";
type SortField = "priority" | "start_time" | null;
type SortDir = "asc" | "desc";

const priorityColors: Record<string, { text: string; bg: string; border: string }> = {
    Critical: { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20" },
    Major:    { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
    Minor:    { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
    Warning:  { text: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
};

const priorityOrder: Record<string, number> = {
    Critical: 4, Major: 3, Minor: 2, Warning: 1,
};

const technologyColors: Record<string, { text: string; bg: string; border: string }> = {
    "2G": { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20" },
    "3G": { text: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
    "4G": { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
    "5G": { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20" },
};

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

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
                <button onClick={(e) => { e.stopPropagation(); handleSave(); }} disabled={saving} className="text-green-400 hover:text-green-300 shrink-0">
                    <Check size={14} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleCancel(); }} className="text-white/40 hover:text-white shrink-0">
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
                className="text-white/20 hover:text-white/60 opacity-0 group-hover:opacity-100 shrink-0"
            >
                <Pencil size={12} />
            </button>
        </div>
    );
};

const SortIcon = ({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) => {
    if (sortField !== field) return <ChevronsUpDown size={12} className="text-white/20" />;
    return sortDir === "asc"
        ? <ChevronUp size={12} className="text-white/60" />
        : <ChevronDown size={12} className="text-white/60" />;
};

const IncidentsTable = () => {
    const { incidents, loading: incidentsLoading, error: incidentsError } = useIncidents();
    const { alarms, loading: alarmsLoading, error: alarmsError } = useAlarms();
    const { user } = useUser();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<Tab>("incidents");
    const [sortField, setSortField] = useState<SortField>(null);
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [sortClick, setSortClick] = useState<number>(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const handleSort = (field: SortField) => {
        setPage(1);
        if (sortField !== field) {
            setSortField(field);
            setSortDir("desc");
            setSortClick(1);
        } else if (sortClick === 1) {
            setSortDir("asc");
            setSortClick(2);
        } else {
            setSortField(null);
            setSortDir("desc");
            setSortClick(0);
        }
    };

    const sortedIncidents = [...incidents].sort((a, b) => {
        if (!sortField) return 0;
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortField === "priority") return ((priorityOrder[a.priority] ?? 0) - (priorityOrder[b.priority] ?? 0)) * dir;
        if (sortField === "start_time") return (new Date(a.start_time).getTime() - new Date(b.start_time).getTime()) * dir;
        return 0;
    });

    const sortedAlarms = [...alarms].sort((a, b) => {
        if (!sortField) return 0;
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortField === "start_time") return (new Date(a.start_time).getTime() - new Date(b.start_time).getTime()) * dir;
        return 0;
    });

    const loading = activeTab === "incidents" ? incidentsLoading : alarmsLoading;
    const error = activeTab === "incidents" ? incidentsError : alarmsError;
    const totalItems = activeTab === "incidents" ? sortedIncidents.length : sortedAlarms.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    const paginatedIncidents = sortedIncidents.slice((page - 1) * pageSize, page * pageSize);
    const paginatedAlarms = sortedAlarms.slice((page - 1) * pageSize, page * pageSize);

    const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalItems);

    return (
        <div className="border border-white/10 rounded-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1 gap-1">
                        {(["incidents", "alarms"] as Tab[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => { setActiveTab(tab); setSortField(null); setSortClick(0); setPage(1); }}
                                className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors
                                    ${activeTab === tab ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                    {activeTab === "incidents" && user?.role !== "admin" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            Assigned to me
                        </span>
                    )}
                </div>
                <span className="text-white/30 text-xs">{totalItems} total</span>
            </div>

            {/* Column labels */}
            {activeTab === "incidents" ? (
                <div className="grid grid-cols-5 px-5 py-2 border-b border-white/5">
                    <span className="text-white/30 text-xs">ID</span>
                    <button onClick={() => handleSort("priority")} className="flex items-center gap-1 text-white/30 text-xs hover:text-white/60 w-fit">
                        Priority <SortIcon field="priority" sortField={sortField} sortDir={sortDir} />
                    </button>
                    <button onClick={() => handleSort("start_time")} className="flex items-center gap-1 text-white/30 text-xs hover:text-white/60 w-fit">
                        Start Time <SortIcon field="start_time" sortField={sortField} sortDir={sortDir} />
                    </button>
                    <span className="text-white/30 text-xs">Assigned To</span>
                    <span className="text-white/30 text-xs">Message</span>
                </div>
            ) : (
                <div className="grid grid-cols-5 px-5 py-2 border-b border-white/5">
                    <span className="text-white/30 text-xs">ID</span>
                    <span className="text-white/30 text-xs">Problem</span>
                    <span className="text-white/30 text-xs">Technology</span>
                    <button onClick={() => handleSort("start_time")} className="flex items-center gap-1 text-white/30 text-xs hover:text-white/60 w-fit">
                        Start Time <SortIcon field="start_time" sortField={sortField} sortDir={sortDir} />
                    </button>
                    <span className="text-white/30 text-xs">Location</span>
                </div>
            )}

            {/* Rows */}
            <div className="divide-y divide-white/5">
                {loading && <p className="text-white/40 text-sm px-5 py-4">Loading...</p>}
                {error && <p className="text-red-400 text-sm px-5 py-4">{error}</p>}

                {activeTab === "incidents" && !loading && !error && paginatedIncidents.length === 0 && (
                    <p className="text-white/40 text-sm px-5 py-4">
                        {user?.role === "admin" ? "No active incidents" : "No incidents assigned to you"}
                    </p>
                )}
                {activeTab === "incidents" && !loading && !error && paginatedIncidents.map((incident) => {
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
                            <span className="text-white/50 text-xs">{new Date(incident.start_time).toLocaleString()}</span>
                            <span className="text-xs">
                                {incident.assigned_to
                                    ? <AssignedEmail userId={incident.assigned_to} />
                                    : <span className="text-white/30">Unassigned</span>
                                }
                            </span>
                            <MessageCell incidentId={incident.incident_id} initialMessage={incident.messages} />
                        </div>
                    );
                })}

                {activeTab === "alarms" && !loading && !error && paginatedAlarms.length === 0 && (
                    <p className="text-white/40 text-sm px-5 py-4">No alarms found</p>
                )}
                {activeTab === "alarms" && !loading && !error && paginatedAlarms.map((alarm) => {
                    const colors = technologyColors[alarm.tehnologie] ?? {
                        text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20",
                    };
                    return (
                        <div
                            key={alarm.alarm_id}
                            className="grid grid-cols-5 items-center px-5 py-3 hover:bg-white/5 transition-colors"
                        >
                            <span className="text-white/70 text-sm font-mono">ALM{alarm.alarm_id}</span>
                            <span className="text-white/60 text-xs truncate pr-2">
                                {alarm.type?.reason ?? "—"}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border w-fit ${colors.bg} ${colors.text} ${colors.border}`}>
                                {alarm.tehnologie}
                            </span>
                            <span className="text-white/50 text-xs">{new Date(alarm.start_time).toLocaleString()}</span>
                            <span className="text-white/50 text-xs truncate">
                                {alarm.site ? `${alarm.site.city}` : "—"}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Pagination footer */}
            {!loading && !error && totalItems > 0 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-white/10">

                    {/* Left — showing X to Y of Z + page size selector */}
                    <div className="flex items-center gap-3">
                        <span className="text-white/30 text-xs">
                            {startItem}–{endItem} of {totalItems}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-white/30 text-xs">Rows:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                                className="bg-white/5 border border-white/10 text-white/60 text-xs rounded-md px-2 py-1 outline-none focus:border-white/30"
                                style={{ background: "#0a0015" }}
                            >
                                {PAGE_SIZE_OPTIONS.map(size => (
                                    <option key={size} value={size} style={{ background: "#0a0015" }}>{size}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Right — prev/next with page info */}
                    <div className="flex items-center gap-2">
                        <span className="text-white/30 text-xs">
                            Page {page} of {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-1 text-white/40 hover:text-white disabled:opacity-30 transition-colors rounded-md hover:bg-white/5"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-1 text-white/40 hover:text-white disabled:opacity-30 transition-colors rounded-md hover:bg-white/5"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IncidentsTable;