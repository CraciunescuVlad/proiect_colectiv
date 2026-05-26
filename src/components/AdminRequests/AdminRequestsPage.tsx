import { useEffect, useState } from "react";
import { useUser } from "../../context/UserContext";

interface AdminRequest {
    id_request: number;
    user_id: string;
    email: string;
    status: string;
    created_at: string;
}

interface MyRequest {
    id_request: number;
    status: string;
    created_at: string;
}

const AdminRequestsPage = () => {
    const { user } = useUser();
    const isAdmin = user?.role === "admin";

    const [requests, setRequests] = useState<AdminRequest[]>([]);
    const [myRequest, setMyRequest] = useState<MyRequest | null | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [actionId, setActionId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const token = () => localStorage.getItem("token");

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                if (isAdmin) {
                    const res = await fetch("http://localhost:3000/admin-requests", {
                        headers: { Authorization: `Bearer ${token()}` },
                    });
                    const data = await res.json();
                    setRequests(Array.isArray(data) ? data : []);
                } else {
                    const res = await fetch("http://localhost:3000/admin-requests/my", {
                        headers: { Authorization: `Bearer ${token()}` },
                    });
                    const data = await res.json();
                    setMyRequest(res.ok && data && data.status ? data : null);
                }
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [isAdmin]);

    const handleRequest = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch("http://localhost:3000/admin-requests", {
                method: "POST",
                headers: { Authorization: `Bearer ${token()}` },
            });
            const data = await res.json();
            if (res.ok) {
                setMyRequest(data);
            } else if (res.status === 409) {
                // Already has a pending request — reload to sync state
                const myRes = await fetch("http://localhost:3000/admin-requests/my", {
                    headers: { Authorization: `Bearer ${token()}` },
                });
                const myData = await myRes.json();
                setMyRequest(myRes.ok && myData && myData.status ? myData : null);
            } else {
                setError("Something went wrong. Please try again later.");
            }
        } catch {
            setError("Something went wrong. Please try again later.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDecision = async (id: number, action: "approve" | "reject") => {
        setActionId(id);
        try {
            await fetch(`http://localhost:3000/admin-requests/${id}/${action}`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token()}` },
            });
            setRequests(prev => prev.filter(r => r.id_request !== id));
        } finally {
            setActionId(null);
        }
    };

    const statusBadge = (status: string) => {
        if (status === "approved") return <span className="text-xs px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">Approved</span>;
        if (status === "rejected") return <span className="text-xs px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">Rejected</span>;
        return <span className="text-xs px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">Pending</span>;
    };

    return (
        <div className="flex flex-col min-h-screen bg-[#060010] px-12 py-8">
            <h1 className="text-white text-2xl font-semibold mb-2">Admin Access</h1>
            <p className="text-white/40 text-sm mb-8">
                {isAdmin ? "Review and manage admin access requests." : "Request elevated access to the platform."}
            </p>

            {loading ? (
                <p className="text-white/30">Loading...</p>
            ) : isAdmin ? (
                <div className="border border-white/10 rounded-2xl p-6 max-w-2xl">
                    <h2 className="text-white font-medium text-sm mb-4">
                        Pending Requests {requests.length > 0 && <span className="ml-2 text-white/30">({requests.length})</span>}
                    </h2>
                    {requests.length === 0 ? (
                        <p className="text-white/30 text-sm">No pending requests.</p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {requests.map(r => (
                                <div key={r.id_request} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                                    <div>
                                        <p className="text-white text-sm">{r.email}</p>
                                        <p className="text-white/30 text-xs mt-0.5">{new Date(r.created_at).toLocaleString()}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleDecision(r.id_request, "approve")}
                                            disabled={actionId === r.id_request}
                                            className="px-4 py-1.5 bg-green-500/10 text-green-400 border border-green-500/20 text-xs rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-40"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => handleDecision(r.id_request, "reject")}
                                            disabled={actionId === r.id_request}
                                            className="px-4 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 text-xs rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-40"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="border border-white/10 rounded-2xl p-6 max-w-md">
                    <h2 className="text-white font-medium text-sm mb-1">Your Access Level</h2>
                    <p className="text-white/40 text-xs mb-6">Current role: <span className="text-white/70">{user?.role}</span></p>

                    {myRequest === undefined ? null : myRequest === null ? (
                        <div>
                            <p className="text-white/50 text-sm mb-1">
                                Admin access unlocks the following capabilities:
                            </p>
                            <ul className="text-white/40 text-xs mb-5 mt-2 space-y-1 list-disc list-inside">
                                <li>Assign responders to active incidents</li>
                                <li>Send and manage incident messages</li>
                                <li>Approve or reject admin access requests</li>
                                <li>Generate and send incident reports</li>
                            </ul>
                            {error && (
                                <p className="text-red-400 text-xs mb-3">{error}</p>
                            )}
                            <button
                                onClick={handleRequest}
                                disabled={submitting}
                                className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                            >
                                {submitting ? "Submitting..." : "Request Admin Access"}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <p className="text-white/50 text-sm">Request status</p>
                                {statusBadge(myRequest.status)}
                            </div>
                            {myRequest.status === "pending" && (
                                <p className="text-white/60 text-sm">
                                    Your application is under consideration at the moment. We will come back to you soon.
                                </p>
                            )}
                            <p className="text-white/30 text-xs">Submitted on {new Date(myRequest.created_at).toLocaleString()}</p>
                            {myRequest.status === "rejected" && (
                                <>
                                    {error && (
                                        <p className="text-red-400 text-xs">{error}</p>
                                    )}
                                    <button
                                        onClick={handleRequest}
                                        disabled={submitting}
                                        className="w-full py-2 mt-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {submitting ? "Submitting..." : "Submit New Request"}
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminRequestsPage;
