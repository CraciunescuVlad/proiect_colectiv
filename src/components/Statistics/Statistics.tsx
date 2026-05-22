import { useState } from "react";
import type { DateRange } from "react-day-picker";
import LineChartCard from "./LineChartCard";
import DateRangePicker from "./DateRangePicker";
import TechnologyPieChart from "./TechnologyPieChart";
import SiteSelector from "./SiteSelector";
import ProfileSelector from "./ProfileSelector";
import StatCard from "../Home/StatCard";
import useAuth from "../../hooks/useAuth";
import useViewerKpis from "../../hooks/useViewerKpis";


const getDefaultRange = (): DateRange => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from, to };
};

// Formats a duration in minutes as a short human-readable string
const formatMinutes = (minutes: number): string => {
    if (minutes <= 0) {
        return "0m";
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) {
        return `${mins}m`;
    }
    return `${hours}h ${mins}m`;
};

const Statistics = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";

    const [range, setRange] = useState<DateRange | undefined>(getDefaultRange());
    const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

    const { kpis, loading: kpisLoading } = useViewerKpis(selectedProfileId, range?.from, range?.to);

    // Filters are mutually exclusive: selecting sites clears the profile, and vice versa
    const handleSiteChange = (siteIds: string[]) => {
        setSelectedSiteIds(siteIds);
        if (siteIds.length > 0) {
            setSelectedProfileId(null);
        }
    };

    const handleProfileChange = (profileId: string | null) => {
        setSelectedProfileId(profileId);
        if (profileId !== null) {
            setSelectedSiteIds([]);
        }
    };

    // Title reflects which filter (if any) is active
    let pageTitle = "Statistics";
    if (selectedProfileId !== null) {
        pageTitle = "Viewer Statistics";
    } else if (selectedSiteIds.length > 0) {
        pageTitle = "Site Statistics";
    }

    // Determines which layout to show: viewer-focused vs. default
    const viewerMode = selectedProfileId !== null;

    const avgResolutionLabel = kpisLoading ? "..." : formatMinutes(kpis?.avgResolutionMinutes ?? 0);
    const assignedCountLabel = kpisLoading ? "..." : `${kpis?.assignedCount ?? 0}`;
    const resolvedCountLabel = kpisLoading ? "..." : `${kpis?.resolvedCount ?? 0}`;

    // Counter label for the selected sites summary
    let sitesSummary = "";
    if (selectedSiteIds.length === 1) {
        sitesSummary = "1 site selected";
    } else if (selectedSiteIds.length > 1) {
        sitesSummary = `${selectedSiteIds.length} sites selected`;
    }

    return (
        <div className="flex flex-col h-screen bg-[#060010] px-24 py-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
                <h1 className="text-white text-2xl font-semibold">{pageTitle}</h1>
                <div className="flex items-center gap-4">
                    {isAdmin && (
                        <ProfileSelector
                            selectedProfileId={selectedProfileId}
                            onChange={handleProfileChange}
                        />
                    )}
                    <SiteSelector
                        selectedSiteIds={selectedSiteIds}
                        onChange={handleSiteChange}
                    />
                    <DateRangePicker range={range} onChange={setRange} />
                </div>
            </div>

            {selectedSiteIds.length > 0 && (
                <div className="flex flex-col items-end gap-1 mb-6">
                    <p className="text-white/60 text-xs">{sitesSummary}</p>
                    <p className="text-white/40 text-xs">{selectedSiteIds.join(", ")}</p>
                </div>
            )}

            {selectedSiteIds.length === 0 && <div className="mb-6" />}

            {viewerMode && (
                <div className="flex w-full mb-8 border border-white/10 rounded-2xl">
                    <StatCard
                        label="Avg Resolution Time"
                        value={avgResolutionLabel}
                        change=""
                        up={true}
                    />
                    <StatCard
                        label="Incidents Assigned"
                        value={assignedCountLabel}
                        change=""
                        up={true}
                    />
                    <StatCard
                        label="Resolved Incidents"
                        value={resolvedCountLabel}
                        change=""
                        up={true}
                    />
                </div>
            )}

            <div className="flex flex-col gap-6">
                <LineChartCard
                    endpoint="incidents/chart"
                    title="Incidents in the selected range"
                    unit="incidents"
                    series={[{ dataKey: "value", color: "#c70606" }]}
                    from={range?.from}
                    to={range?.to}
                    siteIds={selectedSiteIds}
                    assignedTo={selectedProfileId}
                />

                <LineChartCard
                    endpoint="incidents/chart-by-priority"
                    title="Incidents by priority"
                    height={300}
                    capitalizeLegend
                    series={[
                        { dataKey: "Warning", color: "#4afa15" },
                        { dataKey: "Minor", color: "#faeb60" },
                        { dataKey: "Major", color: "#fb923c" },
                        { dataKey: "Critical", color: "#ef4444" },
                    ]}
                    from={range?.from}
                    to={range?.to}
                    siteIds={selectedSiteIds}
                    assignedTo={selectedProfileId}
                />

                <LineChartCard
                    endpoint="incidents/avg-resolution/chart"
                    title="Average incident resolution time"
                    unit="minutes"
                    series={[{ dataKey: "value", color: "#c70606" }]}
                    from={range?.from}
                    to={range?.to}
                    siteIds={selectedSiteIds}
                    assignedTo={selectedProfileId}
                />

                {!viewerMode && (
                    <LineChartCard
                        endpoint="alarms/chart"
                        title="Alarms in the selected range"
                        unit="alarms"
                        series={[{ dataKey: "value", color: "#a263f4" }]}
                        from={range?.from}
                        to={range?.to}
                        siteIds={selectedSiteIds}
                    />
                )}

                {!viewerMode && (
                    <LineChartCard
                        endpoint="alarms/chart-by-severity"
                        title="Alarms by severity"
                        height={300}
                        series={[
                            { dataKey: "Low", color: "#4ade80" },
                            { dataKey: "Medium", color: "#facc15" },
                            { dataKey: "High", color: "#ef4444" },
                        ]}
                        from={range?.from}
                        to={range?.to}
                        siteIds={selectedSiteIds}
                    />
                )}

                {viewerMode && (
                    <TechnologyPieChart
                        endpoint="incidents/by-technology"
                        title="Incidents by technology"
                        from={range?.from}
                        to={range?.to}
                        siteIds={selectedSiteIds}
                        assignedTo={selectedProfileId}
                    />
                )}

                {!viewerMode && (
                    <div className="flex gap-6">
                        <div className="flex-1">
                            <TechnologyPieChart
                                endpoint="alarms/by-technology"
                                title="Alarms by technology"
                                from={range?.from}
                                to={range?.to}
                                siteIds={selectedSiteIds}
                            />
                        </div>
                        <div className="flex-1">
                            <TechnologyPieChart
                                endpoint="incidents/by-technology"
                                title="Incidents by technology"
                                from={range?.from}
                                to={range?.to}
                                siteIds={selectedSiteIds}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Statistics;