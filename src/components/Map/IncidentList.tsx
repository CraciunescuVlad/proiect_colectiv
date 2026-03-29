import IncidentCard from "./IncidentCard";

const incidents = [
    { id: 1, severity: "critical" as const },
    { id: 2, severity: "medium" as const },
    { id: 3, severity: "low" as const },
    { id: 4, severity: "critical" as const },
    { id: 5, severity: "medium" as const },
    { id: 6, severity: "low" as const },
    { id: 7, severity: "critical" as const },
];

const IncidentList = () => {
    return (
        <div className="overflow-y-auto flex flex-col gap-3 h-full">
            {incidents.map((incident) => (
                <IncidentCard key={incident.id} {...incident} />
            ))}
        </div>
    );
};

export default IncidentList;