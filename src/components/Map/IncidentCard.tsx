interface IncidentCardProps {
    id: string;
    title?: string;
    description?: string;
    time?: string;
    severity?: "critical" | "medium" | "low";
}
///com
const severityConfig = {
    critical: { color: "bg-red-400", label: "Critical", text: "text-red-400" },
    medium: { color: "bg-yellow-400", label: "Medium", text: "text-yellow-400" },
    low: { color: "bg-green-400", label: "Low", text: "text-green-400" },
};

const IncidentCard = ({
                          id,
                          title = `Incident #${id}`,
                          description = "Lorem ipsum incident description here",
                          time = "2h ago",
                          severity = "critical",
                      }: IncidentCardProps) => {
    const { color, label, text } = severityConfig[severity];

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-white/10 transition-colors">
            <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium text-sm">{title}</span>
                <span className="text-xs text-white/40">{time}</span>
            </div>
            <p className="text-white/50 text-xs">{description}</p>
            <div className="mt-2 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${color} inline-block`}></span>
                <span className={`${text} text-xs`}>{label}</span>
            </div>
        </div>
    );
};

export default IncidentCard;