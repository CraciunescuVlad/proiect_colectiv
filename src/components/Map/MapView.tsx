import { useEffect, useRef, useState } from "react";
import { authHeaders } from "../../lib/apiHeaders";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Alarm, Site, Incident } from "./MapPage";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

interface MapViewProps {
    view: string;
    sites: Site[];
    standalone_alarms: Alarm[];
    incidents: Incident[];
    incidentSites: Set<string>;
    onMarkerClick: (siteId: string) => void;
    selectedTechs: string[];
    availableTechs: string[];
    onTechFilter: (techs: string[]) => void;
    filter: "all" | "incidents" | "alarms" | "normal";
}
type AlarmInfo = {
    alarm_name: string;
    description: string;
    recommended_action: string;
}
declare global {
    interface Window {
        openAlarmDetails?: (alarmType: string) => Promise<void>;
    }
}


const MapView = ({ view, sites, standalone_alarms, incidents, incidentSites, onMarkerClick , selectedTechs, availableTechs, onTechFilter, filter}: MapViewProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);

    const [selectedAlarmInfo, setSelectedAlarmInfo] = useState<AlarmInfo | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // 1. Inițializare Harta si functie globala pentru Click-uri din Popup
    useEffect(() => {
        if (map.current || !mapContainer.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: "mapbox://styles/mapbox/dark-v11",
            center: [25.0, 45.9439],
            zoom: 6.2,
        });

        map.current.addControl(new mapboxgl.NavigationControl());


        // Expunem funcția global pentru a putea fi apelata din HTML-ul injectat de Mapbox
        window.openAlarmDetails = async (alarmType: string) => {
            try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/map/alarm-type/${alarmType}`, { headers: authHeaders() });
                const data = await res.json();
                setSelectedAlarmInfo(data);
                setIsModalOpen(true);
            } catch (err) {
                console.error("Error fetching alarm details:", err);
            }
        };

        return () => {
            delete window.openAlarmDetails;
        };
    }, []);

    // 2. Gestionare Markeri
    const markersRef = useRef<mapboxgl.Marker[]>([]); // 1. Adaugă o referință persistentă pentru markeri

    useEffect(() => {
        if (!map.current || sites.length === 0) return;

        const updateMarkers = () => {
            // 2. Curata markerii vechi folosind referința persistenta
            markersRef.current.forEach(m => m.remove());
            markersRef.current = []; // Reseteaza vectorul

            sites.forEach((site) => {
                const hasIncident = incidentSites.has(site.id);

                const siteStandaloneAlarms = standalone_alarms.filter(a =>
                    a.site === site.id &&
                    (selectedTechs.length === 0 || selectedTechs.includes(a.tehnologie))
                );
                const hasStandalone = siteStandaloneAlarms.length > 0;
                const isNormal = !hasIncident && !hasStandalone;

                // Apply category filter
                if (filter === "incidents" && !hasIncident) return;
                if (filter === "alarms" && !hasStandalone) return;
                if (filter === "normal" && !isNormal) return;

                const el = document.createElement("div");
                el.className = "marker-container";

                if (hasIncident) {
                    el.innerHTML = `<svg width="14" height="14"><circle cx="7" cy="7" r="6" fill="#ef4444" stroke="white" stroke-width="1.5"/></svg>`;
                } else if (hasStandalone) {
                    el.innerHTML = `<svg width="14" height="14"><rect width="14" height="14" fill="#8b5cf6" stroke="white" stroke-width="1.5"/></svg>`;
                } else {
                    el.innerHTML = `<svg width="16" height="16"><polygon points="8,0 16,16 0,16" fill="#3b82f6" stroke="white" stroke-width="1.5"/></svg>`;
                }

                const marker = new mapboxgl.Marker(el)
                    .setLngLat([site.longitude, site.latitudine])
                    .addTo(map.current!);

                el.addEventListener("click", () => onMarkerClick(site.id));
                markersRef.current.push(marker);
            });
        };

        if (map.current.isStyleLoaded()) {
            updateMarkers();
        } else {
            map.current.once("load", updateMarkers);
        }

        // 4. Funcția de cleanup curata markerii la unmount sau inainte de urmatoarea rulare
        return () => {
            markersRef.current.forEach(m => m.remove());
        };
    }, [sites, standalone_alarms, incidents, incidentSites, selectedTechs, filter]);
    useEffect(() => {
        setTimeout(() => map.current?.resize(), 300);
    }, [view]);

    const technologyColors: Record<string, string> = {
        "2G": "#16a34a",
        "3G": "#2563eb",
        "4G": "#a21caf",
        "5G": "#dc2626",
    };

    const toggleTech = (tech: string) => {
        onTechFilter(
            selectedTechs.includes(tech)
                ? selectedTechs.filter(t => t !== tech)
                : [...selectedTechs, tech]
        );
    };

    return (
        <div className="relative w-full h-full flex flex-col overflow-hidden">

            {/* Filter bar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border-b border-white/10 flex-wrap shrink-0">
                <span className="text-white/40 text-xs">Tehnologie:</span>
                {availableTechs.map(tech => {
                    const isActive = selectedTechs.includes(tech);
                    const color = technologyColors[tech] ?? "#7c3aed";
                    return (
                        <button
                            key={tech}
                            onClick={() => toggleTech(tech)}
                            style={{
                                borderColor: color,
                                backgroundColor: isActive ? color : "transparent",
                                color: isActive ? "white" : color,
                            }}
                            className="text-xs px-3 py-1 rounded-full border transition-all"
                        >
                            {tech}
                        </button>
                    );
                })}
                {selectedTechs.length > 0 && (
                    <button
                        onClick={() => onTechFilter([])}
                        className="text-xs px-3 py-1 rounded-full border border-white/20 text-white/40 hover:text-white transition-all ml-auto"
                    >
                        Reset
                    </button>
                )}
            </div>

            {/* Harta */}
            <div className="relative flex-1">
                <div ref={mapContainer} className="w-full h-full" />

                {isModalOpen && selectedAlarmInfo && (
                    <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="bg-[#1a1025] border border-white/20 p-6 rounded-2xl max-w-md w-full mx-4 shadow-2xl text-white">
                            <div className="flex justify-between items-start mb-4">
                                <h2 className="text-xl font-bold text-purple-400">{selectedAlarmInfo.alarm_name}</h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-white/50 hover:text-white text-2xl leading-none">&times;</button>
                            </div>
                            <div className="space-y-4 text-sm">
                                <p><span className="text-white/40">Descriere:</span><br />{selectedAlarmInfo.description}</p>
                                <p><span className="text-white/40">Acțiune Recomandată:</span><br />{selectedAlarmInfo.recommended_action}</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="mt-6 w-full py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors font-medium"
                            >
                                Închide
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MapView;