import useAlarms from "../../hooks/useAlarms";
import useStats from "../../hooks/useStats";
import StatCard from "./StatCard";
import IncidentsTable from "./IncidentsTable";

const Home = () => {
    const { loading: statsLoading } = useAlarms();
    const { stats } = useStats();

    const totalAlarms = statsLoading ? "..." : `${stats?.total ?? 0}`;
    const totalIncidents = statsLoading ? "..." : `${stats?.totalIncidents ?? 0}`;
    const criticalCount = statsLoading ? "..." : `${stats?.criticalCount ?? 0}`;
    const resolutionRate = statsLoading ? "..." : `${stats?.resolutionRate ?? 0}%`;
    const avgResolveTime = statsLoading ? "..." : (stats?.avgResolveTime ?? "N/A");

    return (
        <div className="flex flex-col bg-[#060010] px-24 py-6 min-h-screen">

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-white text-2xl font-semibold">Dashboard</h1>
            </div>

            {/* Stats row */}
            <div className="flex w-full mb-8">
                <StatCard label="Total Alarms"       value={totalAlarms}         change="25.32%" up={true}  />
                <StatCard label="Incidents"          value={totalIncidents}      change="25.32%" up={true}  />
                <StatCard label="Resolution Rate"    value={resolutionRate}      change="25.32%" up={false} />
                <StatCard label="Avg Resolve Time"   value={avgResolveTime}      change="25.32%" up={false} />
                <StatCard label="Critical Incidents" value={criticalCount}       change="25.32%" up={false} />
            </div>

            {/* Table */}
            <IncidentsTable />

        </div>
    );
};

export default Home;