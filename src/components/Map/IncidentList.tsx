import IncidentCard from "./IncidentCard";
import { locations } from "../../data/locations";

const IncidentList = () => {
    return (
        <div className="overflow-y-auto flex flex-col gap-3 h-full">
            {locations.map((location) => (
                <IncidentCard
                    key={location.id}
                    id={location.id}
                    title={location.name}
                    description={location.description}
                    severity={location.severity}
                />
            ))}
        </div>
    );
};

export default IncidentList;