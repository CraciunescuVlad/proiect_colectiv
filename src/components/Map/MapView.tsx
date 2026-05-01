import { useEffect, useRef, useState } from "react";
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
}

const MapView = ({ view, sites, standalone_alarms, incidents, incidentSites }: MapViewProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);

    const [selectedAlarmInfo, setSelectedAlarmInfo] = useState<any>(null);
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

        // Expunem funcția global pentru a putea fi apelată din HTML-ul injectat de Mapbox
        (window as any).openAlarmDetails = async (alarmType: string) => {
            try {
                const res = await fetch(`http://localhost:3000/alarm_details/${alarmType}`);
                const data = await res.json();
                setSelectedAlarmInfo(data);
                setIsModalOpen(true);
            } catch (err) {
                console.error("Error fetching alarm details:", err);
            }
        };

        return () => {
            delete (window as any).openAlarmDetails;
        };
    }, []);

    // 2. Gestionare Markeri
    useEffect(() => {
        if (!map.current || sites.length === 0) return;

        const technologyColors: Record<string, { bg: string; color: string; border: string }> = {
            "2G": { bg: "#1a2e1a", color: "#4ade80", border: "#16a34a" },
            "3G": { bg: "#1a1a2e", color: "#60a5fa", border: "#2563eb" },
            "4G": { bg: "#2e1a2e", color: "#e879f9", border: "#a21caf" },
            "5G": { bg: "#2e1a1a", color: "#f87171", border: "#dc2626" },
        };

        const getTagStyle = (tech: string) => {
            const colors = technologyColors[tech] ?? { bg: "#1e1035", color: "#a78bfa", border: "#7c3aed" };
            return `background:${colors.bg}; color:${colors.color}; border:1px solid ${colors.border}; cursor:pointer;`;
        };

        const markers: mapboxgl.Marker[] = [];

        const updateMarkers = () => {
            // Curățăm markerii vechi
            markers.forEach(m => m.remove());

            sites.forEach((site) => {
                const hasIncident = incidentSites.has(site.id);
                // Filtrăm alarmele standalone specifice acestui site
                const siteStandaloneAlarms = standalone_alarms.filter(a => a.site === site.id);
                const hasStandalone = siteStandaloneAlarms.length > 0;

                const el = document.createElement("div");
                el.className = "marker-container";

                // Logica vizuală a markerului
                if (hasIncident) {
                    el.innerHTML = `<svg width="14" height="14"><circle cx="7" cy="7" r="6" fill="#ef4444" stroke="white" stroke-width="1.5"/></svg>`;
                } else if (hasStandalone) {
                    el.innerHTML = `<svg width="14" height="14"><rect width="14" height="14" fill="#8b5cf6" stroke="white" stroke-width="1.5"/></svg>`;
                } else {
                    el.innerHTML = `<svg width="16" height="16"><polygon points="8,0 16,16 0,16" fill="#3b82f6" stroke="white" stroke-width="1.5"/></svg>`;
                }

                // Date pentru Popup
                const siteIncident = incidents.find(i => i.alarms?.some(a => a.site === site.id));
                const incidentAlarms = siteIncident ? siteIncident.alarms.filter(a => a.site === site.id) : [];

                const incidentTagsHtml = incidentAlarms.map(a => `
                    <span onclick="window.openAlarmDetails('${a.type}')" style="font-size:10px; border-radius:4px; padding:2px 6px; ${getTagStyle(a.tehnologie)}">
                        ${a.tehnologie} · ${a.type}
                    </span>
                `).join("");

                const standaloneTagsHtml = siteStandaloneAlarms.map(a => `
                    <span onclick="window.openAlarmDetails('${a.type}')" style="font-size:10px; border-radius:4px; padding:2px 6px; ${getTagStyle(a.tehnologie)}">
                        ${a.tehnologie} · ${a.type}
                    </span>
                `).join("");

                const popup = new mapboxgl.Popup({ offset: 12 })
                    .setHTML(`
                        <div style="background:#0a0015; color:white; padding:10px; border-radius:8px; font-family:sans-serif; min-width:180px;">
                            <strong style="font-size:13px;">${site.city}</strong>
                            <p style="font-size:11px; color:#aaa; margin:4px 0 8px;">${site.address}</p>

                            ${siteIncident ? `
                                <div style="margin-top:8px; border-top:1px solid #ffffff20; padding-top:8px;">
                                    <div style="font-size:10px; color:#ef4444; margin-bottom:4px;">● Incident: ${siteIncident.priority}</div>
                                    <div style="display:flex; flex-wrap:wrap; gap:4px;">${incidentTagsHtml}</div>
                                </div>
                            ` : ""}

                            ${hasStandalone ? `
                                <div style="margin-top:8px; border-top:1px solid #ffffff20; padding-top:8px;">
                                    <div style="font-size:10px; color:#8b5cf6; margin-bottom:4px;">Alarme active:</div>
                                    <div style="display:flex; flex-wrap:wrap; gap:4px;">${standaloneTagsHtml}</div>
                                </div>
                            ` : ""}
                        </div>
                    `);

                const marker = new mapboxgl.Marker(el)
                    .setLngLat([site.longitude, site.latitudine])
                    .setPopup(popup)
                    .addTo(map.current!);

                markers.push(marker);
            });
        };

        if (map.current.isStyleLoaded()) updateMarkers();
        else map.current.once("load", updateMarkers);

        return () => {
            markers.forEach(m => m.remove());
        };
    }, [sites, standalone_alarms, incidents, incidentSites]);

    useEffect(() => {
        setTimeout(() => map.current?.resize(), 300);
    }, [view]);

    return (
        <div className="relative w-full h-full">
            <div ref={mapContainer} className="w-full h-full" />

            {/* MODAL DETALII (Pop-up pe mijloc) */}
            {isModalOpen && selectedAlarmInfo && (
                <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1a1025] border border-white/20 p-6 rounded-2xl max-w-md w-full mx-4 shadow-2xl text-white">
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-xl font-bold text-purple-400">{selectedAlarmInfo.alarm_name}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-white/50 hover:text-white text-2xl leading-none">&times;</button>
                        </div>
                        <div className="space-y-4 text-sm">
                            <p><span className="text-white/40">Descriere:</span><br/>{selectedAlarmInfo.description}</p>
                            <p><span className="text-white/40">Acțiune Recomandată:</span><br/>{selectedAlarmInfo.recommended_action}</p>
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
    );
};

export default MapView;