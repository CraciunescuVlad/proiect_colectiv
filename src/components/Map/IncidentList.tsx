import { useEffect, useState } from "react";
import IncidentCard from "./IncidentCard";


type Site = {
    id: string;
    latitudine: number;
    longitude: number;
    city: string;
    address: string;
}

const IncidentList = () => {
    const [sites, setSites] = useState<Site[]>([]);

    useEffect(() => {
        fetch("http://localhost:3000/sites")
            .then(res => res.json())
            .then(data => setSites(data))
            .catch(err => console.error(err));
    }, []);

    return (
        <div className="overflow-y-auto flex flex-col gap-3 h-full">
            {sites.map((site) => (
                <IncidentCard
                    key={site.id}
                    id={site.id}
                    title={site.city}
                    description={site.address}
                />
            ))}
        </div>
    );
};

export default IncidentList;