import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { locations } from "../../data/locations";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const severityColors = {
    critical: "#f87171",
    medium: "#facc15",
    low: "#4ade80",
};

interface MapViewProps {
    view: string;
}

const MapView = ({ view }: MapViewProps) => {
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

        map.current.on("load", () => {
            locations.forEach((location) => {
                // Create marker element
                const el = document.createElement("div");
                el.style.width = "14px";
                el.style.height = "14px";
                el.style.borderRadius = "50%";
                el.style.backgroundColor = severityColors[location.severity];
                el.style.border = "2px solid white";
                el.style.boxShadow = `0 0 8px ${severityColors[location.severity]}`;
                el.style.cursor = "pointer";

                // Add popup
                const popup = new mapboxgl.Popup({ offset: 12 })
                    .setHTML(`
                        <div style="background:#0a0015; color:white; padding:10px; border-radius:8px; font-family:sans-serif;">
                            <strong style="font-size:13px;">${location.name}</strong>
                            <p style="font-size:11px; color:#aaa; margin:4px 0 0;">${location.description}</p>
                            <span style="font-size:11px; color:${severityColors[location.severity]}">
                                ● ${location.severity.charAt(0).toUpperCase() + location.severity.slice(1)}
                            </span>
                        </div>
                    `);

                new mapboxgl.Marker(el)
                    .setLngLat(location.coordinates)
                    .setPopup(popup)
                    .addTo(map.current!);
            });
        });
    }, []);

    useEffect(() => {
        setTimeout(() => map.current?.resize(), 300);
    }, [view]);

    return <div ref={mapContainer} className="w-full h-full" />;
};

export default MapView;