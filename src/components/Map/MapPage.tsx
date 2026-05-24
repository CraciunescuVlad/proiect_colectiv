import { useState, useEffect } from "react";
import MapView from "./MapView";
import IncidentList from "./IncidentList";
import SiteDetailsSidebar from "./SiteDetailsSidebar";
import { useUser } from "../../context/UserContext";

type View = "list" | "split" | "map";
const views: View[] = ["list", "split", "map"];

export type Site = {
    id: string;
    latitudine: number;
    longitude: number;
    city: string;
    address: string;
}

export type Alarm = {
    alarm_id: number;
    status: number;
    start_time: string;
    resolved_time: string;
    type: string;
    tehnologie: string;
    site: string;
}

export type Incident = {
    incident_id: number;
    status: number;
    start_time: string;
    end_time: string;
    priority: string;
    assigned_to: string;
    messages: string;
    alarms: {
        alarm_id: number;
        site: string;
        tehnologie: string;
        type: string;
        status: number;
    }[];
}

export type SelectedSite = {
    site: Site;
    incident: Incident | null;
    standaloneAlarms: Alarm[];
}

const MapPage = () => {
    const { token } = useUser();
    const [view, setView] = useState<View>("split");
    const [sites, setSites] = useState<Site[]>([]);
    const [standaloneAlarms, setStandaloneAlarms] = useState<Alarm[]>([]);
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [incidentSites, setIncidentSites] = useState<Set<string>>(new Set());
    const [selectedSite, setSelectedSite] = useState<SelectedSite | null>(null);
    const [filter, setFilter] = useState<"all" | "incidents" | "alarms" | "normal">("all");
    const [selectedTechs, setSelectedTechs] = useState<string[]>([]);

// Tehnologiile disponibile din toate alarmele
    const availableTechs = [...new Set([
        ...standaloneAlarms.map(a => a.tehnologie),
        ...incidents.flatMap(i => i.alarms?.map(a => a.tehnologie) ?? [])
    ].filter(Boolean))];

// Site-urile filtrate după tehnologie
    const filteredSites = selectedTechs.length === 0
        ? sites
        : sites.filter(site => {
            const hasTechInAlarms = standaloneAlarms.some(a => a.site === site.id && selectedTechs.includes(a.tehnologie));
            const hasTechInIncidents = incidents.some(i => i.alarms?.some(a => a.site === site.id && selectedTechs.includes(a.tehnologie)));
            return hasTechInAlarms || hasTechInIncidents;
        });
    const filteredIncidentSites = new Set(
        [...incidentSites].filter(siteId => filteredSites.some(s => s.id === siteId))
    );


    useEffect(() => {
        if (!token) return;

        const headers = { Authorization: `Bearer ${token}` };

        Promise.all([
            fetch("http://localhost:3000/map/sites", { headers }).then(res => res.json()),
            fetch("http://localhost:3000/map/standalone_alarms", { headers }).then(res => res.json()),
            fetch("http://localhost:3000/map/active_incidents", { headers }).then(res => res.json()),
        ]).then(([sitesData, alarmsData, incidentsData]: [Site[], Alarm[], Incident[]]) => {
            setSites(sitesData);
            setStandaloneAlarms(alarmsData);
            setIncidents(incidentsData);

            const siteIds = new Set<string>(
                incidentsData
                    .flatMap(i => i.alarms ? i.alarms.map(a => a.site) : [])
                    .filter(Boolean)
            );
            setIncidentSites(siteIds);
        }).catch(err => console.error(err));
    }, [token]);

    const handleMarkerClick = (siteId: string) => {
        const site = sites.find(s => s.id === siteId);
        if (!site) return;

        const incident = incidents.find(i => i.alarms?.some(a => a.site === siteId)) ?? null;
        const siteAlarms = standaloneAlarms.filter(a => a.site === siteId);

        setSelectedSite({ site, incident, standaloneAlarms: siteAlarms });
    };


    return (
        <div className="flex flex-col h-screen bg-[#060010]">
            <div className="flex items-center justify-between px-6 pt-6 pb-0">
                <div>
                    <h1 className="text-white text-2xl font-bold mb-1">Sites</h1>
                    <div className="flex items-center gap-2 mt-2">
                        {[
                            { key: "all",       label: "All",       dot: "bg-white/40" },
                            { key: "incidents", label: "Incidents",  dot: "bg-red-400" },
                            { key: "alarms",    label: "Alarms",     dot: "bg-purple-400" },
                            { key: "normal",    label: "Normal",     dot: "bg-green-400" },
                        ].map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key as any)}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors border
                        ${filter === f.key
                                    ? "bg-white/10 text-white border-white/20"
                                    : "text-white/40 border-white/10 hover:text-white hover:bg-white/5"
                                }`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1 gap-1">
                    {views.map((v) => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors
                    ${view === v ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
                        >
                            {v.charAt(0).toUpperCase() + v.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-1 gap-6 p-6 overflow-hidden">
                {view !== "map" && (
                    <div className={view === "list" ? "w-full" : "w-[45%]"}>
                        <IncidentList
                            sites={filteredSites}
                            incidents={incidents}
                            standaloneAlarms={standaloneAlarms}
                            incidentSites={filteredIncidentSites}
                            onSiteClick={handleMarkerClick}
                            filter={filter}
                        />
                    </div>
                )}
                <div className={`rounded-2xl transition-all duration-300 h-full flex
                    ${view === "list" ? "w-0 opacity-0" : view === "map" ? "w-full" : "w-[55%]"}`}>

                    {/* Map — clips to rounded corners */}
                    <div className="flex-1 min-w-0 rounded-2xl overflow-hidden">
                        <MapView
                            view={view}
                            sites={filteredSites}
                            standalone_alarms={standaloneAlarms}
                            incidents={incidents}
                            incidentSites={incidentSites}
                            onMarkerClick={handleMarkerClick}
                            selectedTechs={selectedTechs}
                            availableTechs={availableTechs}
                            onTechFilter={setSelectedTechs}
                        />
                    </div>

                    {/* Sidebar — separate from map, own scroll context */}
                    {selectedSite && (
                        <div style={{ height: "100%", display: "flex" }}>
                            <SiteDetailsSidebar
                                selectedSite={selectedSite}
                                onClose={() => setSelectedSite(null)}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MapPage;