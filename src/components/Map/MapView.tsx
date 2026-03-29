import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

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
    }, []);

    useEffect(() => {
        setTimeout(() => map.current?.resize(), 300);
    }, [view]);

    return <div ref={mapContainer} className="w-full h-full" />;
};

export default MapView;