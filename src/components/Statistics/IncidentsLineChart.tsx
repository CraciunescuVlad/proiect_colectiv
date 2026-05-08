import {
    LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import useIncidentsChart from "./useIncidentsChart";

// Custom tooltip shown when hovering over a point on the chart
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#0a0015] border border-white/10 rounded-lg px-4 py-3">
                <p className="text-white font-semibold text-sm">{payload[0].value} incidents</p>
                <p className="text-white/40 text-xs">{label}</p>
            </div>
        );
    }
    return null;
};

type Props = {
    from?: Date;
    to?: Date;
};
// Line chart showing the number of incidents per day in the last 30 days
const IncidentsLineChart = ({ from, to }: Props) => {
    const { data, loading, error } = useIncidentsChart(from, to);

    return (
        <div className="border border-white/10 rounded-2xl p-6 w-full">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <p className="text-white/60 text-sm">
                    Incidents in the selected range
                </p>
            </div>

            {/* Loading state */}
            {loading && (
                <div className="h-[250px] flex items-center justify-center">
                    <p className="text-white/40 text-sm">Loading chart...</p>
                </div>
            )}

            {/* Error state */}
            {error && (
                <div className="h-[250px] flex items-center justify-center">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* Chart, rendered only when data is ready */}
            {!loading && !error && (
                <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                            dataKey="date"
                            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#f472b6"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 5, fill: "#f472b6", strokeWidth: 0 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};

export default IncidentsLineChart;