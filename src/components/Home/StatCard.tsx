import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
    label: string;
    value: string;
    change: string;
    up: boolean;
    showChange?: boolean;
}

const StatCard = ({ label, value, change, up, showChange = true }: StatCardProps) => (
    <div className="flex-1 px-8 py-5 border-r border-white/10 last:border-r-0">
        <p className="text-white/50 text-sm mb-3">{label}</p>
        <div className="flex items-center gap-3">
            <span className="text-white text-3xl font-semibold">{value}</span>
            {showChange && (
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium
                    ${up ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                    {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {change}
                </span>
            )}
        </div>
    </div>
);

export default StatCard;