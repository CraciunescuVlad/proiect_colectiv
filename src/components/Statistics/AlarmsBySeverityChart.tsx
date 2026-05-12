import {
    LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import useAlarmsBySeverity from "../../hooks/useAlarmsBySeverity";

type Props = {
    from?: Date;
    to?: Date;
};

// Color palette per severity level
const COLORS = {
    Low: "#4ade80",     // green
    Medium: "#facc15",  // yellow
    High: "#ef4444",    // red
};

// Custom tooltip listing all severities for the hovered day
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#0a0015] border border-white/10 rounded-lg px-4 py-3 min-w-[140px]">
                <p className="text-white/40 text-xs mb-2">{label}</p>
                {payload.map((entry: any) => (
                    <div key={entry.dataKey} className="flex items-center justify-between gap-3 text-xs">
                        <span style={{ color: entry.color }}>
                            {entry.dataKey}
                        </span>
                        <span className="text-white font-semibold">{entry.value}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

// Multi-line chart showing alarm counts per day, separated by severity
const AlarmsBySeverityChart = ({ from, to }: Props) => {
    const { data, loading, error } = useAlarmsBySeverity(from, to);

    return (
        <div className="border border-white/10 rounded-2xl p-6 w-full">
            <div className="flex items-center justify-between mb-6">
                <p className="text-white/60 text-sm">Alarms by severity</p>
            </div>

            {loading && (
                <div className="h-[300px] flex items-center justify-center">
                    <p className="text-white/40 text-sm">Loading chart...</p>
                </div>
            )}

            {error && (
                <div className="h-[300px] flex items-center justify-center">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {!loading && !error && (
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            iconType="circle"
                            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                            formatter={(value: string) => (
                                <span className="text-white/60">{value}</span>
                            )}
                        />
                        <Line type="monotone" dataKey="Low"    stroke={COLORS.Low}    strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        <Line type="monotone" dataKey="Medium" stroke={COLORS.Medium} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        <Line type="monotone" dataKey="High"   stroke={COLORS.High}   strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};

export default AlarmsBySeverityChart;