import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Alarm, Site, Incident } from "./MapPage";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

interface MapViewProps {
    view: string;
    sites: Site[];
    alarms: Alarm[];
    incidents: Incident[];
}

const MapView = ({ view, sites, alarms, incidents }: MapViewProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);

    useEffect(() => {
        if (map.current || !mapContainer.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: "mapbox://styles/mapbox/dark-v11",
            center: [25.0, 45.9439],
            zoom: 6.2,
        });

        map.current.addControl(new mapboxgl.NavigationControl());
    }, []);

    useEffect(() => {
        if (!map.current || sites.length === 0 || alarms.length === 0) return;

        // Grupeaza alarmele active per site
        const siteAlarmsMap = new Map<string, Alarm[]>();
        alarms
            .filter(a => a.status === 1)
            .forEach(a => {
                const existing = siteAlarmsMap.get(a.site) ?? [];
                siteAlarmsMap.set(a.site, [...existing, a]);
            });
        const siteIncidentsSet = new Set(
            incidents
                .filter(i => i.status === 1)
                .map(i => {
                    const alarm = alarms.find(a => a.alarm_id === i.alarm_id);
                    return alarm?.site;
                })
                .filter(Boolean)
        );

        const markers: mapboxgl.Marker[] = [];

        const addMarkers = () => {
            sites.forEach((site) => {
                const siteAlarms = siteAlarmsMap.get(site.id) ?? [];
                const hasAlarm = siteAlarms.length > 0;

                const el = document.createElement("div");
                const hasIncident = siteIncidentsSet.has(site.id);

                el.innerHTML = hasIncident
                    ? `<svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
           <circle cx="7" cy="7" r="6" fill="#ef4444" stroke="white" stroke-width="1.5"/>
       </svg>`
                    : hasAlarm
                        ? `<svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
           <rect width="14" height="14" fill="#8b5cf6" stroke="white" stroke-width="1.5"/>
       </svg>`
                        : `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
           <polygon points="8,0 16,16 0,16" fill="#3b82f6" stroke="white" stroke-width="1.5"/>
       </svg>`;

                const technologyColors: Record<string, { bg: string; color: string; border: string }> = {
                    "2G": { bg: "#1a2e1a", color: "#4ade80", border: "#16a34a" },
                    "3G": { bg: "#1a1a2e", color: "#60a5fa", border: "#2563eb" },
                    "4G": { bg: "#2e1a2e", color: "#e879f9", border: "#a21caf" },
                    "5G": { bg: "#2e1a1a", color: "#f87171", border: "#dc2626" },
                };

                const getTagStyle = (tech: string) => {
                    const colors = technologyColors[tech] ?? { bg: "#1e1035", color: "#a78bfa", border: "#7c3aed" };
                    return `background:${colors.bg}; color:${colors.color}; border:1px solid ${colors.border};`;
                };

                const technologyTags = siteAlarms
                    .map(a => `
                       <span style="
                       font-size:10px;
                         border-radius:4px;
                         padding:2px 6px;
                     ${getTagStyle(a.tehnologie)}
                    ">${a.tehnologie}</span>
                `).join("");

                const popup = new mapboxgl.Popup({ offset: 12 })
                    .setHTML(`
                        <div style="background:#0a0015; color:white; padding:10px; border-radius:8px; font-family:sans-serif;">
                            <strong style="font-size:13px;">${site.city}</strong>
                            <p style="font-size:11px; color:#aaa; margin:4px 0 0;">${site.address}</p>
                            ${hasAlarm ? `
                                <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:4px;">
                                    ${technologyTags}
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

        if (map.current.isStyleLoaded()) {
            addMarkers();
        } else {
            map.current.on("load", addMarkers);
        }

        return () => {
            markers.forEach(m => m.remove());
        };

    }, [sites, alarms,incidents]);

    useEffect(() => {
        setTimeout(() => map.current?.resize(), 300);
    }, [view]);

    return <div ref={mapContainer} className="w-full h-full" />;
};

export default MapView;