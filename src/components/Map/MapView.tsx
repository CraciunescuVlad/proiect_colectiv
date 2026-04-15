import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Site } from "./MapPage";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

interface MapViewProps {
    view: string;
    sites: Site[];
}

const MapView = ({ view, sites }: MapViewProps) => {
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
        if (!map.current || sites.length === 0) return;

        const addMarkers = () => {
            sites.forEach((site) => {
                const el = document.createElement("div");
                el.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="8,0 16,16 0,16" fill="#3b82f6" stroke="white" stroke-width="1.5"/>
                    </svg>
                `;
                el.style.cursor = "pointer";

                const popup = new mapboxgl.Popup({ offset: 12 })
                    .setHTML(`
                        <div style="background:#0a0015; color:white; padding:10px; border-radius:8px; font-family:sans-serif;">
                            <strong style="font-size:13px;">${site.city}</strong>
                            <p style="font-size:11px; color:#aaa; margin:4px 0 0;">${site.address}</p>
                        </div>
                    `);

                new mapboxgl.Marker(el)
                    .setLngLat([site.longitude, site.latitudine])
                    .setPopup(popup)
                    .addTo(map.current!);
            });
        };

        if (map.current.isStyleLoaded()) {
            addMarkers();
        } else {
            map.current.on("load", addMarkers);
        }
    }, [sites]);

    useEffect(() => {
        setTimeout(() => map.current?.resize(), 300);
    }, [view]);

    return <div ref={mapContainer} className="w-full h-full" />;
};

export default MapView;