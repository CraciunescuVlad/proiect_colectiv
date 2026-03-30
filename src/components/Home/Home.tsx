import { useNavigate } from "react-router-dom";
import { locations } from "../../data/locations";
import IncidentCard from "../Map/IncidentCard";

const Home = () => {
    const navigate = useNavigate();

    const criticalCount = locations.filter(l => l.severity === "critical").length;
    const mediumCount = locations.filter(l => l.severity === "medium").length;
    const lowCount = locations.filter(l => l.severity === "low").length;

    return (
        <div className="flex flex-col h-screen bg-[#060010] p-6 overflow-y-auto">

            {/* Header */}
            <div className="mb-6">
                <h1 className="text-white text-2xl font-bold">Dashboard</h1>
                <p className="text-white/40 text-sm">Overview of all incidents</p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-white/40 text-xs mb-1">Total Incidents</p>
                    <p className="text-white text-2xl font-bold">{locations.length}</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <p className="text-red-400/70 text-xs mb-1">Critical</p>
                    <p className="text-red-400 text-2xl font-bold">{criticalCount}</p>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                    <p className="text-orange-400/70 text-xs mb-1">Medium</p>
                    <p className="text-orange-400 text-2xl font-bold">{mediumCount}</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                    <p className="text-green-400/70 text-xs mb-1">Low</p>
                    <p className="text-green-400 text-2xl font-bold">{lowCount}</p>
                </div>
            </div>

            {/* Incidents list */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold">Recent Incidents</h2>
                <button
                    onClick={() => navigate("/map")}
                    className="text-white/40 hover:text-white text-sm transition-colors"
                >
                    View on map →
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {locations.map((location) => (
                    <IncidentCard
                        key={location.id}
                        id={location.id}
                        title={location.name}
                        description={location.description}
                        severity={location.severity}
                    />
                ))}
            </div>

        </div>
    );
};

export default Home;