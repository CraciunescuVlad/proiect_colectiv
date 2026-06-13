import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../../context/UserContext";
import type { DateRange } from "react-day-picker";
import DateRangePicker from "../Statistics/DateRangePicker";
import {
    ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown,
    Search, ExternalLink, Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import type { Incident } from "../../hooks/useIncidents";

type View = "incidents" | "alarms";
type IncidentSortField = "start_time" | "end_time" | "priority";
type AlarmSortField = "start_time" | "resolved_time";
type SortDir = "asc" | "desc";

interface AlarmFull {
    alarm_id: number;
    status: number;
    start_time: string;
    resolved_time: string | null;
    tehnologie: string;
    type: { reason: string } | null;
    site: { city: string; address: string } | null;
    incident_id: number | null;
}

const KNOWN_TECHS = ["2G", "3G", "4G", "5G"];
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const priorityColors: Record<string, { text: string; bg: string; border: string }> = {
    Critical: { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20" },
    Major:    { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
    Minor:    { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
    Warning:  { text: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
};

const technologyColors: Record<string, { text: string; bg: string; border: string }> = {
    "2G": { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20" },
    "3G": { text: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
    "4G": { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
    "5G": { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20" },
};

const selectClass =
    "bg-white/5 border border-white/10 text-white/60 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-white/30 h-7";

const getDefaultRange = (): DateRange => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from, to };
};

const toIsoStart = (d: Date) => `${d.toISOString().slice(0, 10)}T00:00:00.000Z`;
const toIsoEnd   = (d: Date) => `${d.toISOString().slice(0, 10)}T23:59:59.999Z`;

function SortIcon<F>({ field, sortField, sortDir }: { field: F; sortField: F; sortDir: SortDir }) {
    if (sortField !== field) return <ChevronsUpDown size={12} className="text-white/20" />;
    return sortDir === "asc"
        ? <ChevronUp size={12} className="text-white/60" />
        : <ChevronDown size={12} className="text-white/60" />;
}

const AdminHistoryPage = () => {
    const { user } = useUser();
    const navigate = useNavigate();

    const [view, setView] = useState<View>("incidents");

    // Date range
    const [range, setRange]     = useState<DateRange | undefined>(getDefaultRange());
    const [allTime, setAllTime] = useState(false);

    // Pagination (0-indexed pages)
    const [page, setPage]         = useState(0);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal]       = useState(0);

    // Results
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [alarms, setAlarms]       = useState<AlarmFull[]>([]);
    const [userMap, setUserMap]     = useState<Record<string, string>>({});
    const [loading, setLoading]         = useState(false);
    const [exporting, setExporting]     = useState(false);
    const [error, setError]             = useState<string | null>(null);

    // Incident filters & sort
    const [incidentId, setIncidentId]         = useState("");
    const [priorityFilter, setPriorityFilter] = useState("");
    const [statusFilter, setStatusFilter]     = useState("");
    const [incidentSort, setIncidentSort]     = useState<IncidentSortField>("start_time");
    const [incidentDir, setIncidentDir]       = useState<SortDir>("desc");

    // Alarm filters & sort
    const [alarmId, setAlarmId]           = useState("");
    const [problemFilter, setProblemFilter] = useState("");
    const [techFilter, setTechFilter]     = useState("");
    const [alarmSort, setAlarmSort]       = useState<AlarmSortField>("start_time");
    const [alarmDir, setAlarmDir]         = useState<SortDir>("desc");

    // Debounced text values
    const [debouncedIncidentId, setDebouncedIncidentId]   = useState("");
    const [debouncedAlarmId, setDebouncedAlarmId]         = useState("");
    const [debouncedProblem, setDebouncedProblem]         = useState("");

    useEffect(() => {
        if (user && user.role !== "admin") navigate("/home");
    }, [user, navigate]);

    // Fetch users map once
    useEffect(() => {
        const token = localStorage.getItem("token");
        fetch(`${import.meta.env.VITE_BACKEND_URL}/users`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => r.json())
            .then((d: { id: string; email: string }[]) => {
                if (!Array.isArray(d)) return;
                const map: Record<string, string> = {};
                d.forEach(u => { map[u.id] = u.email; });
                setUserMap(map);
            })
            .catch(() => {});
    }, []);

    // Debounce text inputs
    useEffect(() => {
        const t = setTimeout(() => setDebouncedIncidentId(incidentId), 400);
        return () => clearTimeout(t);
    }, [incidentId]);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedAlarmId(alarmId), 400);
        return () => clearTimeout(t);
    }, [alarmId]);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedProblem(problemFilter), 400);
        return () => clearTimeout(t);
    }, [problemFilter]);

    // Main fetch
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem("token");
        const h = { Authorization: `Bearer ${token}` };

        const from = (!allTime && range?.from) ? toIsoStart(range.from) : undefined;
        const to   = (!allTime && range?.to)   ? toIsoEnd(range.to)     : undefined;

        const base = new URL(
            view === "incidents"
                ? `${import.meta.env.VITE_BACKEND_URL}/admin/history/incidents`
                : `${import.meta.env.VITE_BACKEND_URL}/admin/history/alarms`
        );

        base.searchParams.set("page", String(page));
        base.searchParams.set("pageSize", String(pageSize));
        if (from) base.searchParams.set("from", from);
        if (to)   base.searchParams.set("to", to);

        if (view === "incidents") {
            base.searchParams.set("sortField", incidentSort);
            base.searchParams.set("sortDir",   incidentDir);
            if (debouncedIncidentId) base.searchParams.set("id", debouncedIncidentId);
            if (priorityFilter)      base.searchParams.set("priority", priorityFilter);
            if (statusFilter)        base.searchParams.set("status", statusFilter);
        } else {
            base.searchParams.set("sortField", alarmSort);
            base.searchParams.set("sortDir",   alarmDir);
            if (debouncedAlarmId)  base.searchParams.set("id", debouncedAlarmId);
            if (techFilter)        base.searchParams.set("tech", techFilter);
            if (debouncedProblem)  base.searchParams.set("problem", debouncedProblem);
        }

        try {
            const res = await fetch(base.toString(), { headers: h });
            const json = await res.json();
            if (!res.ok) { setError(json.message ?? "Error"); return; }
            setTotal(json.total ?? 0);
            if (view === "incidents") setIncidents(json.data ?? []);
            else setAlarms(json.data ?? []);
        } catch {
            setError("Failed to fetch data");
        } finally {
            setLoading(false);
        }
    }, [view, page, pageSize, range, allTime,
        incidentSort, incidentDir, debouncedIncidentId, priorityFilter, statusFilter,
        alarmSort, alarmDir, debouncedAlarmId, techFilter, debouncedProblem]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Helpers
    const handleIncidentSort = (field: IncidentSortField) => {
        if (incidentSort === field) setIncidentDir(d => d === "desc" ? "asc" : "desc");
        else { setIncidentSort(field); setIncidentDir("desc"); }
        setPage(0);
    };

    const handleAlarmSort = (field: AlarmSortField) => {
        if (alarmSort === field) setAlarmDir(d => d === "desc" ? "asc" : "desc");
        else { setAlarmSort(field); setAlarmDir("desc"); }
        setPage(0);
    };

    const resetFilters = () => {
        setIncidentId(""); setPriorityFilter(""); setStatusFilter("");
        setAlarmId(""); setProblemFilter(""); setTechFilter("");
        setPage(0);
    };

    const handleViewChange = (v: View) => {
        setView(v); setPage(0); resetFilters();
    };

    const handleRangeChange = (r: DateRange | undefined) => {
        setRange(r); setAllTime(false); setPage(0);
    };

    const exportToExcel = useCallback(async () => {
        setExporting(true);
        const token = localStorage.getItem("token");
        const h = { Authorization: `Bearer ${token}` };

        const from = (!allTime && range?.from) ? toIsoStart(range.from) : undefined;
        const to   = (!allTime && range?.to)   ? toIsoEnd(range.to)     : undefined;

        const base = new URL(
            view === "incidents"
                ? `${import.meta.env.VITE_BACKEND_URL}/admin/history/incidents`
                : `${import.meta.env.VITE_BACKEND_URL}/admin/history/alarms`
        );
        base.searchParams.set("export", "1");
        if (from) base.searchParams.set("from", from);
        if (to)   base.searchParams.set("to", to);

        if (view === "incidents") {
            base.searchParams.set("sortField", incidentSort);
            base.searchParams.set("sortDir",   incidentDir);
            if (debouncedIncidentId) base.searchParams.set("id", debouncedIncidentId);
            if (priorityFilter)      base.searchParams.set("priority", priorityFilter);
            if (statusFilter)        base.searchParams.set("status", statusFilter);
        } else {
            base.searchParams.set("sortField", alarmSort);
            base.searchParams.set("sortDir",   alarmDir);
            if (debouncedAlarmId)  base.searchParams.set("id", debouncedAlarmId);
            if (techFilter)        base.searchParams.set("tech", techFilter);
            if (debouncedProblem)  base.searchParams.set("problem", debouncedProblem);
        }

        try {
            const res = await fetch(base.toString(), { headers: h });
            const json = await res.json();
            if (!res.ok) return;

            const rows = view === "incidents"
                ? (json.data as Incident[]).map(i => ({
                    "ID":          `INC${i.incident_id}`,
                    "Priority":    i.priority,
                    "Status":      i.status === 1 ? "Active" : "Resolved",
                    "Start Time":  i.start_time ? new Date(i.start_time).toLocaleString() : "",
                    "End Time":    i.end_time   ? new Date(i.end_time).toLocaleString()   : "",
                    "Assigned To": i.assigned_to ? (userMap[i.assigned_to] ?? i.assigned_to) : "Unassigned",
                    "Alarm IDs":   (i.alarm_ids ?? []).map(id => `ALM${id}`).join(", "),
                }))
                : (json.data as AlarmFull[]).map(a => ({
                    "ID":             `ALM${a.alarm_id}`,
                    "Problem":        a.type?.reason ?? "",
                    "Technology":     a.tehnologie,
                    "Start Time":     a.start_time    ? new Date(a.start_time).toLocaleString()    : "",
                    "Resolved Time":  a.resolved_time ? new Date(a.resolved_time).toLocaleString() : "",
                    "Incident ID":    a.incident_id ? `INC${a.incident_id}` : "",
                }));

            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, view === "incidents" ? "Incidents" : "Alarms");

            const dateTag = from && to
                ? `${from.slice(0, 10)}_${to.slice(0, 10)}`
                : allTime ? "all_time" : "export";
            XLSX.writeFile(wb, `${view}_${dateTag}.xlsx`);
        } catch {
            // silent — export is best-effort
        } finally {
            setExporting(false);
        }
    }, [view, range, allTime,
        incidentSort, incidentDir, debouncedIncidentId, priorityFilter, statusFilter,
        alarmSort, alarmDir, debouncedAlarmId, techFilter, debouncedProblem,
        userMap]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const startItem  = total === 0 ? 0 : page * pageSize + 1;
    const endItem    = Math.min((page + 1) * pageSize, total);

    const hasIncidentFilters = !!(incidentId || priorityFilter || statusFilter);
    const hasAlarmFilters    = !!(alarmId || problemFilter || techFilter);

    return (
        <div className="p-6 space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-white text-2xl font-bold">History</h1>
                    <p className="text-white/40 text-sm mt-1">Incident and alarm records</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Date range */}
                    <div className="flex items-center gap-2">
                        <DateRangePicker range={allTime ? undefined : range} onChange={handleRangeChange} />
                        <button
                            onClick={() => { setAllTime(a => !a); setPage(0); }}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                                ${allTime
                                    ? "bg-white/10 text-white border-white/20"
                                    : "bg-white/5 text-white/40 border-white/10 hover:text-white"}`}
                        >
                            All time
                        </button>
                    </div>
                    {/* Export */}
                    <button
                        onClick={exportToExcel}
                        disabled={exporting || loading || total === 0}
                        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Download size={13} />
                        {exporting ? "Exporting…" : "Export Excel"}
                    </button>
                    {/* View toggle */}
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1 gap-1">
                        {(["incidents", "alarms"] as View[]).map(v => (
                            <button key={v} onClick={() => handleViewChange(v)}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors
                                    ${view === v ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}>
                                {v.charAt(0).toUpperCase() + v.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="border border-white/10 rounded-2xl overflow-hidden">

                {/* Filters */}
                <div className="px-5 py-3 border-b border-white/10 flex items-center gap-3 flex-wrap">
                    {view === "incidents" ? (
                        <>
                            <div className="relative flex items-center">
                                <Search size={12} className="absolute left-2 text-white/30" />
                                <input type="text" placeholder="ID…" value={incidentId}
                                    onChange={e => { setIncidentId(e.target.value); setPage(0); }}
                                    className="bg-white/5 border border-white/10 text-white/60 text-xs rounded-lg pl-6 pr-2 py-1.5 outline-none focus:border-white/30 h-7 w-24" />
                            </div>
                            <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(0); }}
                                className={selectClass} style={{ background: "#060010" }}>
                                <option value="">All priorities</option>
                                {["Critical", "Major", "Minor", "Warning"].map(p =>
                                    <option key={p} value={p} style={{ background: "#060010" }}>{p}</option>)}
                            </select>
                            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
                                className={selectClass} style={{ background: "#060010" }}>
                                <option value="">All statuses</option>
                                <option value="active"   style={{ background: "#060010" }}>Active</option>
                                <option value="resolved" style={{ background: "#060010" }}>Resolved</option>
                            </select>
                            {hasIncidentFilters && (
                                <button onClick={resetFilters} className="text-xs text-white/40 hover:text-white transition-colors">Reset</button>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="relative flex items-center">
                                <Search size={12} className="absolute left-2 text-white/30" />
                                <input type="text" placeholder="ID…" value={alarmId}
                                    onChange={e => { setAlarmId(e.target.value); setPage(0); }}
                                    className="bg-white/5 border border-white/10 text-white/60 text-xs rounded-lg pl-6 pr-2 py-1.5 outline-none focus:border-white/30 h-7 w-24" />
                            </div>
                            <div className="relative flex items-center">
                                <Search size={12} className="absolute left-2 text-white/30" />
                                <input type="text" placeholder="Problem…" value={problemFilter}
                                    onChange={e => { setProblemFilter(e.target.value); setPage(0); }}
                                    className="bg-white/5 border border-white/10 text-white/60 text-xs rounded-lg pl-6 pr-2 py-1.5 outline-none focus:border-white/30 h-7 w-36" />
                            </div>
                            <select value={techFilter} onChange={e => { setTechFilter(e.target.value); setPage(0); }}
                                className={selectClass} style={{ background: "#060010" }}>
                                <option value="">All technologies</option>
                                {KNOWN_TECHS.map(t =>
                                    <option key={t} value={t} style={{ background: "#060010" }}>{t}</option>)}
                            </select>
                            {hasAlarmFilters && (
                                <button onClick={resetFilters} className="text-xs text-white/40 hover:text-white transition-colors">Reset</button>
                            )}
                        </>
                    )}
                    <span className="ml-auto text-white/30 text-xs">{total} total</span>
                </div>

                {/* Column headers — incidents */}
                {view === "incidents" && (
                    <div className="grid grid-cols-[5rem_6rem_5.5rem_10rem_10rem_1fr_auto_2rem] gap-2 px-5 py-2 border-b border-white/5">
                        <span className="text-white/30 text-xs">ID</span>
                        <button onClick={() => handleIncidentSort("priority")}
                            className="flex items-center gap-1 text-white/30 text-xs hover:text-white/60 w-fit">
                            Priority <SortIcon field="priority" sortField={incidentSort} sortDir={incidentDir} />
                        </button>
                        <span className="text-white/30 text-xs">Status</span>
                        <button onClick={() => handleIncidentSort("start_time")}
                            className="flex items-center gap-1 text-white/30 text-xs hover:text-white/60 w-fit">
                            Start Time <SortIcon field="start_time" sortField={incidentSort} sortDir={incidentDir} />
                        </button>
                        <button onClick={() => handleIncidentSort("end_time")}
                            className="flex items-center gap-1 text-white/30 text-xs hover:text-white/60 w-fit">
                            End Time <SortIcon field="end_time" sortField={incidentSort} sortDir={incidentDir} />
                        </button>
                        <span className="text-white/30 text-xs">Assigned To</span>
                        <span className="text-white/30 text-xs">Alarms</span>
                        <span />
                    </div>
                )}

                {/* Column headers — alarms */}
                {view === "alarms" && (
                    <div className="grid grid-cols-[5rem_1fr_6rem_10rem_10rem_6rem] gap-2 px-5 py-2 border-b border-white/5">
                        <span className="text-white/30 text-xs">ID</span>
                        <span className="text-white/30 text-xs">Problem</span>
                        <span className="text-white/30 text-xs">Technology</span>
                        <button onClick={() => handleAlarmSort("start_time")}
                            className="flex items-center gap-1 text-white/30 text-xs hover:text-white/60 w-fit">
                            Start Time <SortIcon field="start_time" sortField={alarmSort} sortDir={alarmDir} />
                        </button>
                        <button onClick={() => handleAlarmSort("resolved_time")}
                            className="flex items-center gap-1 text-white/30 text-xs hover:text-white/60 w-fit">
                            Resolved Time <SortIcon field="resolved_time" sortField={alarmSort} sortDir={alarmDir} />
                        </button>
                        <span className="text-white/30 text-xs">Incident</span>
                    </div>
                )}

                {/* Rows */}
                <div className="divide-y divide-white/5">
                    {loading && <p className="text-white/40 text-sm px-5 py-6">Loading…</p>}
                    {!loading && error && <p className="text-red-400 text-sm px-5 py-6">{error}</p>}

                    {/* Incident rows */}
                    {view === "incidents" && !loading && !error && incidents.length === 0 && (
                        <p className="text-white/40 text-sm px-5 py-6">No incidents found</p>
                    )}
                    {view === "incidents" && !loading && !error && incidents.map(incident => {
                        const priority = priorityColors[incident.priority] ?? priorityColors["Warning"];
                        const isActive = incident.status === 1;
                        const alarmIds = incident.alarm_ids ?? [];
                        return (
                            <div key={incident.incident_id}
                                className="grid grid-cols-[5rem_6rem_5.5rem_10rem_10rem_1fr_auto_2rem] gap-2 items-center px-5 py-3 hover:bg-white/5 transition-colors">
                                <span className="text-white/70 text-xs font-mono">INC{incident.incident_id}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full border w-fit ${priority.bg} ${priority.text} ${priority.border}`}>
                                    {incident.priority}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full border w-fit
                                    ${isActive ? "text-green-400 bg-green-500/10 border-green-500/20" : "text-white/40 bg-white/5 border-white/10"}`}>
                                    {isActive ? "Active" : "Resolved"}
                                </span>
                                <span className="text-white/50 text-xs">{new Date(incident.start_time).toLocaleString()}</span>
                                <span className="text-white/50 text-xs">
                                    {incident.end_time ? new Date(incident.end_time).toLocaleString() : <span className="text-white/20">—</span>}
                                </span>
                                <span className="text-white/70 text-xs truncate">
                                    {incident.assigned_to
                                        ? (userMap[incident.assigned_to] ?? incident.assigned_to)
                                        : <span className="text-white/30">Unassigned</span>}
                                </span>
                                <span className="flex flex-wrap gap-1">
                                    {alarmIds.length === 0
                                        ? <span className="text-white/20 text-xs">—</span>
                                        : alarmIds.map(id => (
                                            <span key={id} className="text-xs font-mono text-white/50 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                                                ALM{id}
                                            </span>
                                        ))}
                                </span>
                                <button onClick={() => navigate(`/incident/${incident.incident_id}`)}
                                    className="text-white/20 hover:text-white/60 transition-colors justify-self-end" title="Open incident">
                                    <ExternalLink size={13} />
                                </button>
                            </div>
                        );
                    })}

                    {/* Alarm rows */}
                    {view === "alarms" && !loading && !error && alarms.length === 0 && (
                        <p className="text-white/40 text-sm px-5 py-6">No alarms found</p>
                    )}
                    {view === "alarms" && !loading && !error && alarms.map(alarm => {
                        const colors = technologyColors[alarm.tehnologie] ?? {
                            text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20",
                        };
                        return (
                            <div key={alarm.alarm_id}
                                className="grid grid-cols-[5rem_1fr_6rem_10rem_10rem_6rem] gap-2 items-center px-5 py-3 hover:bg-white/5 transition-colors">
                                <span className="text-white/70 text-xs font-mono">ALM{alarm.alarm_id}</span>
                                <span className="text-white/60 text-xs truncate pr-2">{alarm.type?.reason ?? "—"}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full border w-fit ${colors.bg} ${colors.text} ${colors.border}`}>
                                    {alarm.tehnologie}
                                </span>
                                <span className="text-white/50 text-xs">{new Date(alarm.start_time).toLocaleString()}</span>
                                <span className="text-white/50 text-xs">
                                    {alarm.resolved_time ? new Date(alarm.resolved_time).toLocaleString() : <span className="text-white/20">—</span>}
                                </span>
                                <span className="text-xs font-mono">
                                    {alarm.incident_id
                                        ? <span className="text-white/60">INC{alarm.incident_id}</span>
                                        : <span className="text-white/20">—</span>}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Pagination */}
                {!loading && !error && total > 0 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-white/10">
                        <div className="flex items-center gap-3">
                            <span className="text-white/30 text-xs">{startItem}–{endItem} of {total}</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-white/30 text-xs">Rows:</span>
                                <select value={pageSize}
                                    onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
                                    className="bg-white/5 border border-white/10 text-white/60 text-xs rounded-md px-2 py-1 outline-none focus:border-white/30"
                                    style={{ background: "#060010" }}>
                                    {PAGE_SIZE_OPTIONS.map(s =>
                                        <option key={s} value={s} style={{ background: "#060010" }}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-white/30 text-xs">Page {page + 1} of {totalPages}</span>
                            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                                className="p-1 text-white/40 hover:text-white disabled:opacity-30 transition-colors rounded-md hover:bg-white/5">
                                <ChevronLeft size={16} />
                            </button>
                            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                                className="p-1 text-white/40 hover:text-white disabled:opacity-30 transition-colors rounded-md hover:bg-white/5">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminHistoryPage;
