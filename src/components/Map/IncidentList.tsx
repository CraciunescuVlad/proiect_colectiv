import IncidentCard from "./IncidentCard";
import  type { Site } from "./MapPage";

const IncidentList = ({ sites }: { sites: Site[] }) => {
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