import { useState } from "react";
import type { DateRange } from "react-day-picker";
import LineChartCard from "./LineChartCard";
import DateRangePicker from "./DateRangePicker";
import IncidentsByPriorityChart from "./IncidentsByPriorityChart";
import AlarmsBySeverityChart from "./AlarmsBySeverityChart";
import TechnologyPieChart from "./TechnologyPieChart";
import SiteSelector from "./SiteSelector";


const getDefaultRange = (): DateRange => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from, to };
};

const Statistics = () => {
    const [range, setRange] = useState<DateRange | undefined>(getDefaultRange());
    const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

    // Title changes based on whether a site filter is applied
    const pageTitle = selectedSiteId === null ? "Statistics" : "Site Statistics";

    return (
        <div className="flex flex-col h-screen bg-[#060010] px-24 py-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-white text-2xl font-semibold">{pageTitle}</h1>
                <div className="flex items-center gap-4">
                    <SiteSelector
                        selectedSiteId={selectedSiteId}
                        onChange={setSelectedSiteId}
                    />
                    <DateRangePicker range={range} onChange={setRange} />
                </div>
            </div>

            <div className="flex flex-col gap-6">
                <LineChartCard
                    endpoint="incidents"
                    title="Incidents in the selected range"
                    unit="incidents"
                    color="#c70606"
                    from={range?.from}
                    to={range?.to}
                    siteId={selectedSiteId}
                />

                <IncidentsByPriorityChart
                    from={range?.from}
                    to={range?.to}
                    siteId={selectedSiteId}
                />

                <LineChartCard
                    endpoint="incidents/avg-resolution"
                    title="Average incident resolution time"
                    unit="minutes"
                    color="#c70606"
                    from={range?.from}
                    to={range?.to}
                    siteId={selectedSiteId}
                />

                <LineChartCard
                    endpoint="alarms"
                    title="Alarms in the selected range"
                    unit="alarms"
                    color="#a263f4"
                    from={range?.from}
                    to={range?.to}
                    siteId={selectedSiteId}
                />

                <AlarmsBySeverityChart
                    from={range?.from}
                    to={range?.to}
                    siteId={selectedSiteId}
                />

                <div className="flex gap-6">
                    <div className="flex-1">
                        <TechnologyPieChart
                            endpoint="alarms/by-technology"
                            title="Alarms by technology"
                            from={range?.from}
                            to={range?.to}
                            siteId={selectedSiteId}
                        />
                    </div>
                    <div className="flex-1">
                        <TechnologyPieChart
                            endpoint="incidents/by-technology"
                            title="Incidents by technology"
                            from={range?.from}
                            to={range?.to}
                            siteId={selectedSiteId}
                        />
                    </div>
                </div>


            </div>
        </div>
    );
};

export default Statistics;