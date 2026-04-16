interface IncidentCardProps {
    id: string;
    title?: string;
    description?: string;
    time?: string;
}

const IncidentCard = ({
                          id,
                          title = `Incident #${id}`,
                          description = "Lorem ipsum incident description here",
                          time = "2h ago",
                      }: IncidentCardProps) => {
    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-white/10 transition-colors">
            <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium text-sm">{title}</span>
                <span className="text-xs text-white/40">{time}</span>
            </div>
            <p className="text-white/50 text-xs">{description}</p>
        </div>
    );
};

export default IncidentCard;