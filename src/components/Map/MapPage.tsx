import { useState, useEffect } from "react";
import MapView from "./MapView";
import IncidentList from "./IncidentList";

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
    alarm_id: string;
    status: number;
    start_time: string;
    resolved_time: string;
    type: string;
    tehnologie: string;
    site: string;
}

const MapPage = () => {
    const [view, setView] = useState<View>("split");
    const [sites, setSites] = useState<Site[]>([]);
    const [alarms, setAlarms] = useState<Alarm[]>([]);


    useEffect(() => {
        fetch("http://localhost:3000/sites")
            .then(res => res.json())
            .then(data => setSites(data))
            .catch(err => console.error(err));

        fetch("http://localhost:3000/alarms")
            .then(res => res.json())
            .then(data => setAlarms(data))
            .catch(err => console.error(err));
    }, []);


    return (
        <div className="flex flex-col h-screen bg-[#060010]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-0">
                <div>
                    <h1 className="text-white text-2xl font-bold mb-1">Sites</h1>
                    <p className="text-white/40 text-sm">Showing .......</p>
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

            {/* Content */}
            <div className="flex flex-1 gap-6 p-6 overflow-hidden">
                {view !== "map" && (
                    <div className={view === "list" ? "w-full" : "w-[45%]"}>
                        <IncidentList sites={sites} />
                    </div>
                )}
                <div className={`rounded-2xl overflow-hidden transition-all duration-300
                    ${view === "list" ? "w-0 opacity-0" : view === "map" ? "w-full" : "w-[55%]"}`}>
                    <MapView view={view} sites={sites} alarms={alarms} />
                </div>
            </div>
        </div>
    );
};

export default MapPage;