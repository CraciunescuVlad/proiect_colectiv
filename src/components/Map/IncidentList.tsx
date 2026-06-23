import type { Site, Incident, Alarm } from "./MapPage";

interface IncidentListProps {
    sites: Site[];
    incidents: Incident[];
    standaloneAlarms: Alarm[];
    incidentSites: Set<string>;
    onSiteClick?: (siteId: string) => void;
    filter: "all" | "incidents" | "alarms" | "normal";
}

const priorityColors: Record<string, { text: string; bg: string; border: string; dot: string }> = {
    Critical: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", dot: "bg-red-400" },
    Major: { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", dot: "bg-orange-400" },
    Minor: { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", dot: "bg-yellow-400" },
    Warning: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", dot: "bg-blue-400" },
};

const IncidentList = ({ sites, incidents, standaloneAlarms, incidentSites, onSiteClick, filter }: IncidentListProps) => {

    const incidentSitesList = sites.filter(s => incidentSites.has(s.id));
    const alarmSitesList = sites.filter(s =>
        !incidentSites.has(s.id) && standaloneAlarms.some(a => a.site === s.id)
    );
    const normalSitesList = sites.filter(s =>
        !incidentSites.has(s.id) && !standaloneAlarms.some(a => a.site === s.id)
    );

    const showIncidents = filter === "all" || filter === "incidents";
    const showAlarms = filter === "all" || filter === "alarms";
    const showNormal = filter === "all" || filter === "normal";

    const SectionHeader = ({ label, count, color }: { label: string; count: number; color: string }) => (
        <div className="flex items-center gap-2 px-1 mb-2 mt-4 first:mt-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
            <span className="text-white/50 text-xs font-medium">{label}</span>
            <span className="text-white/20 text-xs">({count})</span>
        </div>
    );

    return (
        <div className="overflow-y-auto flex flex-col h-full px-1">

            {/* Incident sites */}
            {showIncidents && incidentSitesList.length > 0 && (
                <div>
                    <SectionHeader label="Active Incidents" count={incidentSitesList.length} color="bg-red-400" />
                    <div className="flex flex-col gap-2 mb-2">
                        {incidentSitesList.map((site) => {
                            const incident = incidents.find(i => i.alarms?.some(a => a.site === site.id));
                            const priority = incident ? priorityColors[incident.priority] ?? priorityColors["Warning"] : null;
                            return (
                                <div
                                    key={site.id}
                                    onClick={() => onSiteClick?.(site.id)}
                                    className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 cursor-pointer hover:bg-red-500/10 transition-colors"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-white font-medium text-sm">{site.city}</span>
                                        {priority && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${priority.bg} ${priority.text} ${priority.border}`}>
                                                {incident?.priority}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-white/40 text-xs">{site.address}</p>
                                    <p className="text-white/20 text-xs mt-1">ID: {site.id}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Alarm sites */}
            {showAlarms && alarmSitesList.length > 0 && (
                <div>
                    <SectionHeader label="Active Alarms" count={alarmSitesList.length} color="bg-purple-400" />
                    <div className="flex flex-col gap-2 mb-2">
                        {alarmSitesList.map((site) => {
                            const siteAlarms = standaloneAlarms.filter(a => a.site === site.id);
                            return (
                                <div
                                    key={site.id}
                                    onClick={() => onSiteClick?.(site.id)}
                                    className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 cursor-pointer hover:bg-purple-500/10 transition-colors"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-white font-medium text-sm">{site.city}</span>
                                        <span className="text-xs px-2 py-0.5 rounded-full border bg-purple-500/10 text-purple-400 border-purple-500/20">
                                            {siteAlarms.length} alarm{siteAlarms.length > 1 ? "s" : ""}
                                        </span>
                                    </div>
                                    <p className="text-white/40 text-xs">{site.address}</p>
                                    <p className="text-white/20 text-xs mt-1">ID: {site.id}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Normal sites */}
            {showNormal && normalSitesList.length > 0 && (
                <div>
                    <SectionHeader label="Normal" count={normalSitesList.length} color="bg-green-400" />
                    <div className="flex flex-col gap-2">
                        {normalSitesList.map((site) => (
                            <div
                                key={site.id}
                                onClick={() => onSiteClick?.(site.id)}
                                className="bg-white/3 border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-white font-medium text-sm">{site.city}</span>
                                    <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                                </div>
                                <p className="text-white/40 text-xs">{site.address}</p>
                                <p className="text-white/20 text-xs mt-1">ID: {site.id}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {
                (!showIncidents && !showAlarms && !showNormal)
                    ? null
                    : (
                        (!showIncidents || incidentSitesList.length === 0) &&
                        (!showAlarms || alarmSitesList.length === 0) &&
                        (!showNormal || normalSitesList.length === 0)
                    ) ? (
                        <div className="flex flex-col items-center justify-center h-full gap-2">
                            <span className="text-white/20 text-sm">No sites found</span>
                        </div>
                    ) : null
            }


        </div>
    );
};

export default IncidentList;