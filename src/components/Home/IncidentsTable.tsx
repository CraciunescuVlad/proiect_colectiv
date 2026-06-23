import { useEffect, useState, useMemo } from "react";
import useIncidents from "../../hooks/useIncidents";
import useAlarms from "../../hooks/useAlarms";
import { useUser } from "../../context/UserContext";
import { Pencil, Check, X, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
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

const selectClass = "bg-white/5 border border-white/10 text-white/60 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-white/30 h-7";

const AssignedEmail = ({ userId }: { userId: string }) => {
    const [email, setEmail] = useState<string | null>(null);
    useEffect(() => {
        const fetch_user = async () => {
            try {
                const token = localStorage.getItem("token");
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/${userId}`, {
                    headers: { "Authorization": `Bearer ${token}` },
                });
                const data = await res.json();
                setEmail(data.email ?? null);
            } catch { setEmail(null); }
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
            await fetch(`${import.meta.env.VITE_BACKEND_URL}/incidents/${incidentId}/message`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
                body: JSON.stringify({ messages: message }),
            });
            setEditing(false);
        } catch (err) { console.error(err); } finally { setSaving(false); }
    };

    const handleCancel = () => { setMessage(initialMessage ?? ""); setEditing(false); };

    if (user?.role !== "admin") return <span className="text-white/40 text-xs">{message || "—"}</span>;

    if (editing) return (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <input type="text" value={message} onChange={(e) => setMessage(e.target.value)}
                   className="bg-white/10 text-white text-xs border border-white/20 rounded px-2 py-1 outline-none focus:border-white/50 w-full"
                   autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
            />
            <button onClick={(e) => { e.stopPropagation(); handleSave(); }} disabled={saving} className="text-green-400 hover:text-green-300 shrink-0"><Check size={14} /></button>
            <button onClick={(e) => { e.stopPropagation(); handleCancel(); }} className="text-white/40 hover:text-white shrink-0"><X size={14} /></button>
        </div>
    );

    return (
        <div className="flex items-center gap-2 group" onClick={(e) => e.stopPropagation()}>
            <span className="text-white/40 text-xs">{message || "—"}</span>
            <button onClick={(e) => { e.stopPropagation(); setEditing(true); }} className="text-white/20 hover:text-white/60 opacity-0 group-hover:opacity-100 shrink-0"><Pencil size={12} /></button>
        </div>
    );
};

const SortIcon = ({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) => {
    if (sortField !== field) return <ChevronsUpDown size={12} className="text-white/20" />;
    return sortDir === "asc" ? <ChevronUp size={12} className="text-white/60" /> : <ChevronDown size={12} className="text-white/60" />;
};

const IncidentsTable = () => {
    const { incidents, loading: incidentsLoading, error: incidentsError } = useIncidents();
    const { alarms, loading: alarmsLoading, error: alarmsError } = useAlarms();
    const { user } = useUser();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<Tab>("incidents");
    const [sortField, setSortField] = useState<SortField>(null);
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [sortClick, setSortClick] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Incident filters
    const [incidentIdFilter, setIncidentIdFilter] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("");
    const [startDateFilter, setStartDateFilter] = useState("");
    const [assignedFilter, setAssignedFilter] = useState("");
    const [users, setUsers] = useState<{ id: string; email: string }[]>([]);

    // Alarm filters
    const [alarmIdFilter, setAlarmIdFilter] = useState("");
    const [problemFilter, setProblemFilter] = useState("");
    const [techFilter, setTechFilter] = useState("");
    const [alarmDateFilter, setAlarmDateFilter] = useState("");
    const [locationFilter, setLocationFilter] = useState("");

    useEffect(() => {
        if (user?.role !== "admin") return;
        fetch(`${import.meta.env.VITE_BACKEND_URL}/users`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
        }).then(r => r.json()).then(data => setUsers(Array.isArray(data) ? data : [])).catch(() => {});
    }, [user]);

    const handleSort = (field: SortField) => {
        setPage(1);
        if (sortField !== field) { setSortField(field); setSortDir("desc"); setSortClick(1); }
        else if (sortClick === 1) { setSortDir("asc"); setSortClick(2); }
        else { setSortField(null); setSortDir("desc"); setSortClick(0); }
    };

    const filteredIncidents = useMemo(() => incidents.filter(i => {
        if (incidentIdFilter && !String(i.incident_id).includes(incidentIdFilter)) return false;
        if (priorityFilter && i.priority !== priorityFilter) return false;
        if (startDateFilter && !new Date(i.start_time).toLocaleDateString().includes(startDateFilter)) return false;
        if (assignedFilter && i.assigned_to !== assignedFilter) return false;
        return true;
    }), [incidents, incidentIdFilter, priorityFilter, startDateFilter, assignedFilter]);

    const filteredAlarms = useMemo(() => alarms.filter(a => {
        if (alarmIdFilter && !String(a.alarm_id).includes(alarmIdFilter)) return false;
        if (problemFilter && !(a.type as any)?.reason?.toLowerCase().includes(problemFilter.toLowerCase())) return false;
        if (techFilter && a.tehnologie !== techFilter) return false;
        if (alarmDateFilter) {
            const d = new Date(a.start_time).toISOString().slice(0, 10);
            if (d !== alarmDateFilter) return false;
        }
        if (locationFilter && (a.site as any)?.city !== locationFilter) return false;
        return true;
    }), [alarms, alarmIdFilter, problemFilter, techFilter, alarmDateFilter, locationFilter]);

    const sortedIncidents = [...filteredIncidents].sort((a, b) => {
        if (!sortField) return 0;
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortField === "priority") return ((priorityOrder[a.priority] ?? 0) - (priorityOrder[b.priority] ?? 0)) * dir;
        if (sortField === "start_time") return (new Date(a.start_time).getTime() - new Date(b.start_time).getTime()) * dir;
        return 0;
    });

    const sortedAlarms = [...filteredAlarms].sort((a, b) => {
        if (!sortField) return 0;
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortField === "start_time") return (new Date(a.start_time).getTime() - new Date(b.start_time).getTime()) * dir;
        return 0;
    });

    const availableTechs = [...new Set(alarms.map(a => a.tehnologie).filter(Boolean))];
    const availableLocations = [...new Set(alarms.map(a => (a.site as any)?.city).filter(Boolean))];

    const loading = activeTab === "incidents" ? incidentsLoading : alarmsLoading;
    const error = activeTab === "incidents" ? incidentsError : alarmsError;
    const totalItems = activeTab === "incidents" ? sortedIncidents.length : sortedAlarms.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const paginatedIncidents = sortedIncidents.slice((page - 1) * pageSize, page * pageSize);
    const paginatedAlarms = sortedAlarms.slice((page - 1) * pageSize, page * pageSize);
    const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalItems);

    const resetFilters = () => {
        setIncidentIdFilter(""); setPriorityFilter(""); setStartDateFilter(""); setAssignedFilter("");
        setAlarmIdFilter(""); setProblemFilter(""); setTechFilter(""); setAlarmDateFilter(""); setLocationFilter("");
        setPage(1);
    };

    return (
        <div className="border border-white/10 rounded-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1 gap-1">
                        {(["incidents", "alarms"] as Tab[]).map((tab) => (
                            <button key={tab}
                                    onClick={() => { setActiveTab(tab); setSortField(null); setSortClick(0); setPage(1); resetFilters(); }}
                                    className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${activeTab === tab ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                    {activeTab === "incidents" && user?.role !== "admin" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">Assigned to me</span>
                    )}
                </div>
                <span className="text-white/30 text-xs">{totalItems} total</span>
            </div>

            {/* Filters */}
            <div className="px-5 py-3 border-b border-white/5 bg-white/2">
                {activeTab === "incidents" ? (
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Search ID */}
                        <div className="relative flex items-center">
                            <Search size={12} className="absolute left-2 text-white/30" />
                            <input
                                type="text"
                                placeholder="Search ID..."
                                value={incidentIdFilter}
                                onChange={(e) => { setIncidentIdFilter(e.target.value); setPage(1); }}
                                className="bg-white/5 border border-white/10 text-white/60 text-xs rounded-lg pl-6 pr-2 py-1.5 outline-none focus:border-white/30 h-7 w-28"
                            />
                        </div>
                        {/* Priority */}
                        <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }} className={selectClass} style={{ background: "#060010" }}>
                            <option value="">All priorities</option>
                            {["Critical", "Major", "Minor", "Warning"].map(p => (
                                <option key={p} value={p} style={{ background: "#060010" }}>{p}</option>
                            ))}
                        </select>
                        {/* Date */}
                        <input
                            type="date"
                            value={startDateFilter}
                            onChange={(e) => { setStartDateFilter(e.target.value); setPage(1); }}
                            className={`${selectClass} w-36`}
                            style={{ background: "#060010", colorScheme: "dark" }}
                        />
                        {/* Assigned to — admin only */}
                        {user?.role === "admin" && (
                            <select value={assignedFilter} onChange={(e) => { setAssignedFilter(e.target.value); setPage(1); }} className={selectClass} style={{ background: "#060010" }}>
                                <option value="">All users</option>
                                <option value="unassigned" style={{ background: "#060010" }}>Unassigned</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id} style={{ background: "#060010" }}>{u.email}</option>
                                ))}
                            </select>
                        )}
                        {/* Reset */}
                        {(incidentIdFilter || priorityFilter || startDateFilter || assignedFilter) && (
                            <button onClick={resetFilters} className="text-xs text-white/40 hover:text-white transition-colors">Reset</button>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Search alarm ID */}
                        <div className="relative flex items-center">
                            <Search size={12} className="absolute left-2 text-white/30" />
                            <input
                                type="text"
                                placeholder="Search ID..."
                                value={alarmIdFilter}
                                onChange={(e) => { setAlarmIdFilter(e.target.value); setPage(1); }}
                                className="bg-white/5 border border-white/10 text-white/60 text-xs rounded-lg pl-6 pr-2 py-1.5 outline-none focus:border-white/30 h-7 w-28"
                            />
                        </div>
                        {/* Search problem */}
                        <div className="relative flex items-center">
                            <Search size={12} className="absolute left-2 text-white/30" />
                            <input
                                type="text"
                                placeholder="Search problem..."
                                value={problemFilter}
                                onChange={(e) => { setProblemFilter(e.target.value); setPage(1); }}
                                className="bg-white/5 border border-white/10 text-white/60 text-xs rounded-lg pl-6 pr-2 py-1.5 outline-none focus:border-white/30 h-7 w-36"
                            />
                        </div>
                        {/* Technology */}
                        <select value={techFilter} onChange={(e) => { setTechFilter(e.target.value); setPage(1); }} className={selectClass} style={{ background: "#060010" }}>
                            <option value="">All technologies</option>
                            {availableTechs.map(t => (
                                <option key={t} value={t} style={{ background: "#060010" }}>{t}</option>
                            ))}
                        </select>
                        {/* Date */}
                        <input
                            type="date"
                            value={alarmDateFilter}
                            onChange={(e) => { setAlarmDateFilter(e.target.value); setPage(1); }}
                            className={`${selectClass} w-36`}
                            style={{ background: "#060010", colorScheme: "dark" }}
                        />
                        {/* Location */}
                        <select value={locationFilter} onChange={(e) => { setLocationFilter(e.target.value); setPage(1); }} className={selectClass} style={{ background: "#060010" }}>
                            <option value="">All locations</option>
                            {availableLocations.map(l => (
                                <option key={l} value={l} style={{ background: "#060010" }}>{l}</option>
                            ))}
                        </select>
                        {/* Reset */}
                        {(alarmIdFilter || problemFilter || techFilter || alarmDateFilter || locationFilter) && (
                            <button onClick={resetFilters} className="text-xs text-white/40 hover:text-white transition-colors">Reset</button>
                        )}
                    </div>
                )}
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
                        <div key={incident.incident_id} onClick={() => navigate(`/incident/${incident.incident_id}`)}
                             className="grid grid-cols-5 items-center px-5 py-3 hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            <span className="text-white/70 text-sm font-mono">INC{incident.incident_id}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border w-fit ${priority.bg} ${priority.text} ${priority.border}`}>{incident.priority}</span>
                            <span className="text-white/50 text-xs">{new Date(incident.start_time).toLocaleString()}</span>
                            <span className="text-xs">
                                {incident.assigned_to ? <AssignedEmail userId={incident.assigned_to} /> : <span className="text-white/30">Unassigned</span>}
                            </span>
                            <MessageCell incidentId={incident.incident_id} initialMessage={incident.messages} />
                        </div>
                    );
                })}

                {activeTab === "alarms" && !loading && !error && paginatedAlarms.length === 0 && (
                    <p className="text-white/40 text-sm px-5 py-4">No alarms found</p>
                )}
                {activeTab === "alarms" && !loading && !error && paginatedAlarms.map((alarm) => {
                    const colors = technologyColors[alarm.tehnologie] ?? { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" };
                    return (
                        <div key={alarm.alarm_id} className="grid grid-cols-5 items-center px-5 py-3 hover:bg-white/5 transition-colors">
                            <span className="text-white/70 text-sm font-mono">ALM{alarm.alarm_id}</span>
                            <span className="text-white/60 text-xs truncate pr-2">{(alarm.type as any)?.reason ?? "—"}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border w-fit ${colors.bg} ${colors.text} ${colors.border}`}>{alarm.tehnologie}</span>
                            <span className="text-white/50 text-xs">{new Date(alarm.start_time).toLocaleString()}</span>
                            <span className="text-white/50 text-xs">{(alarm.site as any)?.city ?? "—"}</span>
                        </div>
                    );
                })}
            </div>

            {/* Pagination */}
            {!loading && !error && totalItems > 0 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-white/10">
                    <div className="flex items-center gap-3">
                        <span className="text-white/30 text-xs">{startItem}–{endItem} of {totalItems}</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-white/30 text-xs">Rows:</span>
                            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                                    className="bg-white/5 border border-white/10 text-white/60 text-xs rounded-md px-2 py-1 outline-none focus:border-white/30"
                                    style={{ background: "#060010" }}
                            >
                                {PAGE_SIZE_OPTIONS.map(size => (
                                    <option key={size} value={size} style={{ background: "#060010" }}>{size}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-white/30 text-xs">Page {page} of {totalPages}</span>
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="p-1 text-white/40 hover:text-white disabled:opacity-30 transition-colors rounded-md hover:bg-white/5">
                            <ChevronLeft size={16} />
                        </button>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="p-1 text-white/40 hover:text-white disabled:opacity-30 transition-colors rounded-md hover:bg-white/5">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IncidentsTable;