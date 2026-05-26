import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useUser } from "../../context/UserContext";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

interface IncidentDetail {
    incident_id: number;
    status: number;
    start_time: string;
    end_time: string | null;
    priority: string;
    assigned_to: string | null;
    messages: string | null;
    alarms: {
        alarm_id: number;
        site: string;
        tehnologie: string;
        type: string;
        status: number;
    }[];
}

interface Message {
    id_messaje: number;
    id_user: string;
    time: string;
    message: string;
}

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

    return <span>{email ?? "..."}</span>;
};

const IncidentMap = ({ siteId }: { siteId: string }) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const [site, setSite] = useState<{ latitudine: number; longitude: number; city: string } | null>(null);

    useEffect(() => {
        const fetchSite = async () => {
            try {
                const res = await fetch(`http://localhost:3000/map/sites/${siteId}`);
                const data = await res.json();
                setSite(data);
            } catch (err) {
                console.error("Failed to fetch site", err);
            }
        };
        fetchSite();
    }, [siteId]);

    useEffect(() => {
        if (!site || !mapContainer.current || map.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: "mapbox://styles/mapbox/dark-v11",
            center: [site.longitude, site.latitudine],
            zoom: 13,
        });

        const el = document.createElement("div");
        el.style.width = "14px";
        el.style.height = "14px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = "#ef4444";
        el.style.border = "2px solid white";
        el.style.boxShadow = "0 0 8px #ef4444";

        new mapboxgl.Marker(el)
            .setLngLat([site.longitude, site.latitudine])
            .addTo(map.current);
    }, [site]);

    if (!site) return (
        <div className="h-64 flex items-center justify-center bg-white/5 rounded-xl">
            <p className="text-white/40 text-xs">Loading map...</p>
        </div>
    );

    return <div ref={mapContainer} className="w-full h-64 rounded-xl overflow-hidden" />;
};

const IncidentPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useUser();
    const [incident, setIncident] = useState<IncidentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState(false);
    const [recentMessages, setRecentMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [sendingMessage, setSendingMessage] = useState(false);
    const [messageError, setMessageError] = useState<string | null>(null);
    const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
    const [showReportPanel, setShowReportPanel] = useState(false);
    const [reportRecipient, setReportRecipient] = useState("");
    const [reportEmailInput, setReportEmailInput] = useState("");
    const [reportMode, setReportMode] = useState<"user" | "email">("user");
    const [sendingReport, setSendingReport] = useState(false);
    const [reportSent, setReportSent] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);
    const [showResolvePanel, setShowResolvePanel] = useState(false);
    const [resolveDateTime, setResolveDateTime] = useState("");
    const [resolveMessage, setResolveMessage] = useState("");
    const [resolvingIncident, setResolvingIncident] = useState(false);
    const [resolveError, setResolveError] = useState<string | null>(null);

    useEffect(() => {
        const fetchIncident = async () => {
            try {
                const token = localStorage.getItem("token");
                const [incidentRes, messagesRes] = await Promise.all([
                    fetch(`http://localhost:3000/incidents/${id}`, {
                        headers: { "Authorization": `Bearer ${token}` },
                    }),
                    fetch(`http://localhost:3000/incidents/${id}/messages`, {
                        headers: { "Authorization": `Bearer ${token}` },
                    }),
                ]);
                const data = await incidentRes.json();
                const msgs = await messagesRes.json();
                setIncident(data);
                setRecentMessages(Array.isArray(msgs) ? [...msgs].reverse() : []);
            } catch (err) {
                console.error("Failed to fetch incident", err);
            } finally {
                setLoading(false);
            }
        };
        fetchIncident();
    }, [id]);

    const handleOpenReport = async () => {
        setShowReportPanel(true);
        setReportSent(false);
        setReportError(null);
        if (users.length > 0) return;
        try {
            const res = await fetch("http://localhost:3000/users", {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
            });
            const data = await res.json();
            setUsers(Array.isArray(data) ? data : []);
        } catch {
            setUsers([]);
        }
    };

    const handleSendReport = async () => {
        const isEmailMode = reportMode === "email";
        if (isEmailMode && !reportEmailInput.trim()) return;
        if (!isEmailMode && !reportRecipient) return;

        setSendingReport(true);
        setReportError(null);
        try {
            const body = isEmailMode
                ? { recipient_email: reportEmailInput.trim() }
                : { recipient_id: reportRecipient };

            const res = await fetch(`http://localhost:3000/incidents/${id}/send-report`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                setReportSent(true);
                setShowReportPanel(false);
                setReportRecipient("");
                setReportEmailInput("");
            } else {
                setReportError("Something went wrong. Please try again.");
            }
        } catch {
            setReportError("Something went wrong. Please try again.");
        } finally {
            setSendingReport(false);
        }
    };

    const handleResolveIncident = async () => {
        if (!resolveDateTime || !resolveMessage.trim()) return;
        setResolvingIncident(true);
        setResolveError(null);
        try {
            const res = await fetch(`http://localhost:3000/incidents/${id}/resolve`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({ end_time: new Date(resolveDateTime).toISOString(), message: resolveMessage.trim() }),
            });
            if (res.ok) {
                const data = await res.json();
                setIncident(prev => prev ? {
                    ...prev,
                    end_time: data.end_time,
                    status: 0,
                    alarms: prev.alarms.map(a => ({ ...a, status: 0 })),
                } : prev);
                setRecentMessages(prev => [
                    ...prev.slice(-2),
                    { id_messaje: Date.now(), id_user: user?.id ?? "", time: new Date().toISOString(), message: resolveMessage.trim() },
                ]);
                setShowResolvePanel(false);
                setResolveDateTime("");
                setResolveMessage("");
            } else {
                setResolveError("Something went wrong. Please try again.");
            }
        } catch {
            setResolveError("Something went wrong. Please try again.");
        } finally {
            setResolvingIncident(false);
        }
    };

    const handleAssign = async () => {
        if (!incident || !user) return;
        setAssigning(true);
        try {
            const res = await fetch(`http://localhost:3000/incidents/${id}/assign`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({ assigned_to: user.id }),
            });
            const data = await res.json();
            setIncident(prev => prev ? { ...prev, assigned_to: data.assigned_to } : prev);
        } catch (err) {
            console.error("Failed to assign", err);
        } finally {
            setAssigning(false);
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;
        setSendingMessage(true);
        setMessageError(null);
        try {
            const res = await fetch(`http://localhost:3000/incidents/${id}/message`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({ message: newMessage.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setMessageError(data.message ?? `Error ${res.status}`);
                return;
            }
            setIncident(prev => prev ? { ...prev, messages: data.messages } : prev);
            setRecentMessages(prev => [
                ...prev.slice(-2),
                { id_messaje: Date.now(), id_user: user?.id ?? "", time: new Date().toISOString(), message: newMessage.trim() },
            ]);
            setNewMessage("");
        } catch (err) {
            setMessageError("Network error — check backend is running");
            console.error("Failed to send message", err);
        } finally {
            setSendingMessage(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-screen bg-[#060010]">
            <p className="text-white/40">Loading incident...</p>
        </div>
    );

    if (!incident) return (
        <div className="flex items-center justify-center h-screen bg-[#060010]">
            <p className="text-red-400">Incident not found</p>
        </div>
    );

    const priority = priorityColors[incident.priority] ?? priorityColors["Warning"];
    const firstSiteId = incident.alarms?.[0]?.site;

    return (
        <div className="flex flex-col min-h-screen bg-[#060010] px-12 py-8">

            {/* Back button */}
            <button
                onClick={() => navigate("/home")}
                className="flex items-center gap-2 text-white/40 hover:text-white text-sm mb-8 transition-colors w-fit"
            >
                <ArrowLeft size={16} />
                Back to dashboard
            </button>

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <h1 className="text-white text-2xl font-semibold">INC{incident.incident_id}</h1>
                    <span className={`text-xs px-3 py-1 rounded-full border ${priority.bg} ${priority.text} ${priority.border}`}>
                        {incident.priority}
                    </span>
                    <span className={`text-xs px-3 py-1 rounded-full border ${
                        incident.status === 1
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : "bg-green-500/10 text-green-400 border-green-500/20"
                    }`}>
                        {incident.status === 1 ? "Active" : "Resolved"}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6">

                {/* Left column */}
                <div className="col-span-2 flex flex-col gap-6">

                    {/* Info card */}
                    <div className="border border-white/10 rounded-2xl p-6">
                        <h2 className="text-white font-medium text-sm mb-4">Incident Details</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-white/40 text-xs mb-1">Start Time</p>
                                <p className="text-white text-sm">{new Date(incident.start_time).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-white/40 text-xs mb-1">End Time</p>
                                <p className="text-white text-sm">{incident.end_time ? new Date(incident.end_time).toLocaleString() : "—"}</p>
                            </div>
                            <div>
                                <p className="text-white/40 text-xs mb-1">Assigned To</p>
                                <p className="text-white text-sm">
                                    {incident.assigned_to
                                        ? <AssignedEmail userId={incident.assigned_to} />
                                        : <span className="text-white/30">Unassigned</span>
                                    }
                                </p>
                            </div>
                            <div>
                                <p className="text-white/40 text-xs mb-1">Priority</p>
                                <p className={`text-sm ${priority.text}`}>{incident.priority}</p>
                            </div>
                        </div>
                    </div>

                    {/* Messages card */}
                    <div className="border border-white/10 rounded-2xl p-6">
                        <h2 className="text-white font-medium text-sm mb-4">Messages</h2>
                        <div className="flex flex-col gap-3 mb-4">
                            {recentMessages.length === 0 ? (
                                <p className="text-white/30 text-sm">No messages yet.</p>
                            ) : (
                                recentMessages.map((msg) => (
                                    <div key={msg.id_messaje} className="bg-white/5 border border-white/10 rounded-lg px-4 py-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-white/60 text-xs font-medium"><AssignedEmail userId={msg.id_user} /></span>
                                            <span className="text-white/30 text-xs">{new Date(msg.time).toLocaleString()}</span>
                                        </div>
                                        <p className="text-white/70 text-sm">{msg.message}</p>
                                    </div>
                                ))
                            )}
                        </div>
                        {user?.role === "admin" && (
                            <>
                                <div className="flex gap-2">
                                    <textarea
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Add a message..."
                                        className="flex-1 bg-white/5 text-white text-sm border border-white/20 rounded-lg px-4 py-3 outline-none focus:border-white/50 resize-none h-20 placeholder:text-white/20"
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={sendingMessage || !newMessage.trim()}
                                        className="self-end bg-white text-gray-900 text-xs font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40"
                                    >
                                        {sendingMessage ? "Sending..." : "Send"}
                                    </button>
                                </div>
                                {messageError && (
                                    <p className="text-red-400 text-xs mt-2">We're sorry! Something went wrong.</p>
                                )}
                            </>
                        )}
                    </div>

                    {/* Alarms card */}
                    <div className="border border-white/10 rounded-2xl p-6">
                        <h2 className="text-white font-medium text-sm mb-4">
                            Related Alarms ({incident.alarms?.length ?? 0})
                        </h2>
                        {incident.alarms?.length === 0 ? (
                            <p className="text-white/30 text-sm">No alarms linked</p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {incident.alarms?.map((alarm) => {
                                    const colors = technologyColors[alarm.tehnologie] ?? {
                                        text: "text-purple-400",
                                        bg: "bg-purple-500/10",
                                        border: "border-purple-500/20",
                                    };
                                    return (
                                        <div
                                            key={alarm.alarm_id}
                                            className="flex items-center justify-between px-4 py-3 bg-white/3 border border-white/10 rounded-lg"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`text-xs px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
                                                    {alarm.tehnologie} · {alarm.type}
                                                </span>
                                                <span className="text-white/40 text-xs">Site: {alarm.site}</span>
                                            </div>
                                            <span className={`text-xs ${alarm.status === 1 ? "text-red-400" : "text-green-400"}`}>
                                                {alarm.status === 1 ? "Active" : "Resolved"}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right column — map + actions */}
                <div className="flex flex-col gap-6">

                    {/* Map */}
                    <div className="border border-white/10 rounded-2xl overflow-hidden">
                        <div className="px-5 py-3 border-b border-white/10">
                            <h2 className="text-white font-medium text-sm">Location</h2>
                            {firstSiteId && (
                                <p className="text-white/30 text-xs mt-0.5">Site: {firstSiteId}</p>
                            )}
                        </div>
                        <div className="p-3">
                            {firstSiteId
                                ? <IncidentMap siteId={firstSiteId} />
                                : <p className="text-white/30 text-xs py-4 text-center">No site linked</p>
                            }
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="border border-white/10 rounded-2xl p-6">
                        <h2 className="text-white font-medium text-sm mb-4">Actions</h2>
                        <div className="flex flex-col gap-3">
                            {user?.role === "admin" && (
                                <button
                                    onClick={handleAssign}
                                    disabled={assigning}
                                    className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {assigning ? "Assigning..." : incident.assigned_to === user.id ? "Reassign to me" : "Assign to me"}
                                </button>
                            )}

                            {!incident.end_time && (user?.role === "admin" || incident.assigned_to === user?.id) && (
                                !showResolvePanel ? (
                                    <button
                                        onClick={() => {
                                            const now = new Date();
                                            const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
                                                .toISOString()
                                                .slice(0, 16);
                                            setResolveDateTime(local);
                                            setShowResolvePanel(true);
                                            setResolveError(null);
                                        }}
                                        className="w-full py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 hover:text-green-300 text-sm rounded-lg transition-colors"
                                    >
                                        Mark as Resolved
                                    </button>
                                ) : (
                                    <div className="flex flex-col gap-2 border border-white/10 rounded-xl p-3">
                                        <p className="text-white/50 text-xs">Set end date &amp; time</p>
                                        <input
                                            type="datetime-local"
                                            value={resolveDateTime}
                                            onChange={(e) => setResolveDateTime(e.target.value)}
                                            className="w-full text-sm border border-white/20 rounded-lg px-3 py-2 outline-none focus:border-white/50 bg-[#1a1030] text-white [color-scheme:dark]"
                                        />
                                        <textarea
                                            value={resolveMessage}
                                            onChange={(e) => setResolveMessage(e.target.value)}
                                            placeholder="Completion message (required)..."
                                            className="w-full bg-white/5 text-white text-sm border border-white/20 rounded-lg px-3 py-2 outline-none focus:border-white/50 resize-none h-20 placeholder:text-white/30"
                                        />
                                        {resolveError && (
                                            <p className="text-red-400 text-xs">{resolveError}</p>
                                        )}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleResolveIncident}
                                                disabled={resolvingIncident || !resolveDateTime || !resolveMessage.trim()}
                                                className="flex-1 py-2 bg-green-500/20 text-green-400 text-xs font-medium rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-40"
                                            >
                                                {resolvingIncident ? "Saving..." : "Confirm"}
                                            </button>
                                            <button
                                                onClick={() => { setShowResolvePanel(false); setResolveDateTime(""); setResolveMessage(""); setResolveError(null); }}
                                                className="flex-1 py-2 bg-white/5 text-white/70 text-xs rounded-lg hover:bg-white/10 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )
                            )}

                            {!showReportPanel ? (
                                <button
                                    onClick={handleOpenReport}
                                    className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-sm rounded-lg transition-colors"
                                >
                                    Send Report
                                </button>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {/* Mode toggle */}
                                    <div className="flex rounded-lg overflow-hidden border border-white/10 text-xs">
                                        <button
                                            onClick={() => setReportMode("user")}
                                            className={`flex-1 py-1.5 transition-colors ${reportMode === "user" ? "bg-white/10 text-white" : "bg-transparent text-white/40 hover:text-white/70"}`}
                                        >
                                            Select user
                                        </button>
                                        <button
                                            onClick={() => setReportMode("email")}
                                            className={`flex-1 py-1.5 transition-colors ${reportMode === "email" ? "bg-white/10 text-white" : "bg-transparent text-white/40 hover:text-white/70"}`}
                                        >
                                            Custom email
                                        </button>
                                    </div>

                                    {reportMode === "user" ? (
                                        <select
                                            value={reportRecipient}
                                            onChange={(e) => setReportRecipient(e.target.value)}
                                            className="w-full text-sm border border-white/20 rounded-lg px-3 py-2 outline-none focus:border-white/50"
                                            style={{ backgroundColor: "#1a1030", color: "white" }}
                                        >
                                            <option value="" disabled style={{ backgroundColor: "#1a1030", color: "#6b7280" }}>Select recipient...</option>
                                            {users.map(u => (
                                                <option key={u.id} value={u.id} style={{ backgroundColor: "#1a1030", color: "white" }}>{u.email}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="email"
                                            value={reportEmailInput}
                                            onChange={(e) => setReportEmailInput(e.target.value)}
                                            placeholder="Enter email address..."
                                            className="w-full text-sm border border-white/20 rounded-lg px-3 py-2 outline-none focus:border-white/50 bg-[#1a1030] text-white placeholder:text-white/30"
                                        />
                                    )}

                                    {reportError && (
                                        <p className="text-red-400 text-xs">{reportError}</p>
                                    )}

                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSendReport}
                                            disabled={sendingReport || (reportMode === "user" ? !reportRecipient : !reportEmailInput.trim())}
                                            className="flex-1 py-2 bg-white text-gray-900 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40"
                                        >
                                            {sendingReport ? "Sending..." : "Send"}
                                        </button>
                                        <button
                                            onClick={() => { setShowReportPanel(false); setReportRecipient(""); setReportEmailInput(""); setReportError(null); }}
                                            className="flex-1 py-2 bg-white/5 text-white/70 text-xs rounded-lg hover:bg-white/10 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                            {reportSent && (
                                <p className="text-green-400 text-xs text-center">Report sent successfully.</p>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default IncidentPage;