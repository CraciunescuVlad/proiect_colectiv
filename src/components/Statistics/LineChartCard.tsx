import {
    LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import useChartData from "../../hooks/useChartDataStat";

type Props = {
    endpoint: string;
    title: string;
    unit: string;
    color: string;
    from?: Date;
    to?: Date;
};

// Custom tooltip shown when hovering over a point on the chart
const CustomTooltip = ({ active, payload, label, unit }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#0a0015] border border-white/10 rounded-lg px-4 py-3">
                <p className="text-white font-semibold text-sm">{payload[0].value} {unit}</p>
                <p className="text-white/40 text-xs">{label}</p>
            </div>
        );
    }
    return null;
};

// Reusable line chart card that fetches and displays time-series data
const LineChartCard = ({ endpoint, title, unit, color, from, to }: Props) => {
    const { data, loading, error } = useChartData(endpoint, from, to);

    return (
        <div className="border border-white/10 rounded-2xl p-6 w-full">
            <div className="flex items-center justify-between mb-6">
                <p className="text-white/60 text-sm">{title}</p>
            </div>

            {loading && (
                <div className="h-[250px] flex items-center justify-center">
                    <p className="text-white/40 text-sm">Loading chart...</p>
                </div>
            )}

            {error && (
                <div className="h-[250px] flex items-center justify-center">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {!loading && !error && (
                <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip unit={unit} />} />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};

export default LineChartCard;