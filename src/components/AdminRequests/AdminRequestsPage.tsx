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

type CreateStatus =
    | { type: "success"; email: string }
    | { type: "error"; message: string }
    | null;

const AdminRequestsPage = () => {
    const { user } = useUser();
    const isAdmin = user?.role === "admin";

    const [requests, setRequests] = useState<AdminRequest[]>([]);
    const [myRequest, setMyRequest] = useState<MyRequest | null | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [actionId, setActionId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    // --- Create User state ---
    const [createEmail, setCreateEmail] = useState("");
    const [creating, setCreating] = useState(false);
    const [createStatus, setCreateStatus] = useState<CreateStatus>(null);
    const [emailError, setEmailError] = useState("");

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

    const handleDecision = async (
        id: number,
        action: "approve" | "reject"
    ) => {
        setActionId(id);

        try {
            await fetch(`http://localhost:3000/admin-requests/${id}/${action}`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token()}` },
            });

            setRequests(prev =>
                prev.filter(r => r.id_request !== id)
            );
        } finally {
            setActionId(null);
        }
    };

    const validateEmail = (email: string) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const handleCreateUser = async () => {
        setEmailError("");
        setCreateStatus(null);

        if (!createEmail.trim()) {
            setEmailError("Email is required.");
            return;
        }

        if (!validateEmail(createEmail)) {
            setEmailError("Please enter a valid email address.");
            return;
        }

        setCreating(true);

        try {
            const res = await fetch("http://localhost:3000/users/create-by-admin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token()}`,
                },
                body: JSON.stringify({
                    email: createEmail.trim(),
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setCreateStatus({
                    type: "success",
                    email: createEmail.trim(),
                });

                setCreateEmail("");
            } else {
                setCreateStatus({
                    type: "error",
                    message:
                        data?.message ||
                        "An error occurred. Please try again.",
                });
            }
        } catch {
            setCreateStatus({
                type: "error",
                message:
                    "Network error. Please check your internet connection.",
            });
        } finally {
            setCreating(false);
        }
    };

    const statusBadge = (status: string) => {
        if (status === "approved")
            return (
                <span className="text-xs px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                    Approved
                </span>
            );

        if (status === "rejected")
            return (
                <span className="text-xs px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                    Rejected
                </span>
            );

        return (
            <span className="text-xs px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                Pending
            </span>
        );
    };

    return (
        <div className="flex flex-col min-h-screen bg-[#060010] px-12 py-8">
            <h1 className="text-white text-2xl font-semibold mb-2">
                Admin Access
            </h1>

            <p className="text-white/40 text-sm mb-8">
                {isAdmin
                    ? "Review and manage admin access requests."
                    : "Request elevated access to the platform."}
            </p>

            {loading ? (
                <p className="text-white/30">Loading...</p>
            ) : isAdmin ? (
                <div className="flex flex-col gap-6 max-w-2xl">

                    {/* CREATE USER ACCOUNT */}
                    <div className="border border-white/10 rounded-2xl p-6">
                        <h2 className="text-white font-medium text-sm mb-1">
                            Create User Account
                        </h2>

                        <p className="text-white/40 text-xs mb-5">
                            Create a new account for an email address.
                            A password will be automatically generated
                            and sent to the user.
                        </p>

                        <div className="flex flex-col gap-3">

                            <div className="flex gap-3">

                                <div className="flex-1 flex flex-col gap-1">
                                    <input
                                        type="email"
                                        placeholder="email@example.com"
                                        value={createEmail}
                                        onChange={e => {
                                            setCreateEmail(e.target.value);
                                            setEmailError("");
                                            setCreateStatus(null);
                                        }}
                                        onKeyDown={e =>
                                            e.key === "Enter" &&
                                            handleCreateUser()
                                        }
                                        disabled={creating}
                                        className={`w-full bg-white/5 border ${
                                            emailError
                                                ? "border-red-500/50"
                                                : "border-white/10"
                                        } rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors disabled:opacity-50`}
                                    />

                                    {emailError && (
                                        <p className="text-red-400 text-xs px-1">
                                            {emailError}
                                        </p>
                                    )}
                                </div>

                                <button
                                    onClick={handleCreateUser}
                                    disabled={creating}
                                    className="px-5 py-2.5 bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                                >
                                    {creating ? (
                                        <span className="flex items-center gap-2">
                                            <svg
                                                className="animate-spin h-3.5 w-3.5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                            >
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                />

                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8v8z"
                                                />
                                            </svg>

                                            Please wait...
                                        </span>
                                    ) : (
                                        "Create Account"
                                    )}
                                </button>
                            </div>

                            {/* SUCCESS */}
                            {createStatus?.type === "success" && (
                                <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
                                    <svg
                                        className="w-4 h-4 text-green-400 mt-0.5 shrink-0"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>

                                    <div>
                                        <p className="text-green-400 text-sm font-medium">
                                            Account created successfully
                                        </p>

                                        <p className="text-green-400/70 text-xs mt-0.5">
                                            An email with the credentials
                                            has been sent to{" "}
                                            <span className="font-medium text-green-400">
                                                {createStatus.email}
                                            </span>.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* ERROR */}
                            {createStatus?.type === "error" && (
                                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                                    <svg
                                        className="w-4 h-4 text-red-400 mt-0.5 shrink-0"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>

                                    <p className="text-red-400 text-sm">
                                        {createStatus.message}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* PENDING REQUESTS */}
                    <div className="border border-white/10 rounded-2xl p-6">

                        <h2 className="text-white font-medium text-sm mb-4">
                            Pending Requests

                            {requests.length > 0 && (
                                <span className="ml-2 text-white/30">
                                    ({requests.length})
                                </span>
                            )}
                        </h2>

                        {requests.length === 0 ? (
                            <p className="text-white/30 text-sm">
                                No pending requests.
                            </p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {requests.map(r => (
                                    <div
                                        key={r.id_request}
                                        className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3"
                                    >
                                        <div>
                                            <p className="text-white text-sm">
                                                {r.email}
                                            </p>

                                            <p className="text-white/30 text-xs mt-0.5">
                                                {new Date(r.created_at).toLocaleString()}
                                            </p>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() =>
                                                    handleDecision(r.id_request, "approve")
                                                }
                                                disabled={actionId === r.id_request}
                                                className="px-4 py-1.5 bg-green-500/10 text-green-400 border border-green-500/20 text-xs rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-40"
                                            >
                                                Approve
                                            </button>

                                            <button
                                                onClick={() =>
                                                    handleDecision(r.id_request, "reject")
                                                }
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
                </div>
            ) : (
                <div className="border border-white/10 rounded-2xl p-6 max-w-md">

                    <h2 className="text-white font-medium text-sm mb-1">
                        Your Access Level
                    </h2>

                    <p className="text-white/40 text-xs mb-6">
                        Current role:{" "}
                        <span className="text-white/70">
                            {user?.role}
                        </span>
                    </p>

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
                                {submitting
                                    ? "Submitting..."
                                    : "Request Admin Access"}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">

                            <div className="flex items-center justify-between">
                                <p className="text-white/50 text-sm">
                                    Request status
                                </p>

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