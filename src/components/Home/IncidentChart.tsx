import { useState } from "react";
import {
    AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import useChartData from "../../hooks/useChartData";

type ChartTab = "incidents" | "alarms";

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#0a0015] border border-white/10 rounded-lg px-4 py-3">
                <p className="text-white font-semibold text-sm">{payload[0].value} events</p>
                <p className="text-white/40 text-xs">{label}</p>
            </div>
        );
    }
    return null;
};

const IncidentChart = () => {
    const [activeTab, setActiveTab] = useState<ChartTab>("alarms");
    const { data, loading, error } = useChartData(activeTab);

    const color = activeTab === "incidents" ? "#f472b6" : "#818cf8";

    return (
        <div className="border border-white/10 rounded-2xl p-6 w-full">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <p className="text-white/60 text-sm">
                    All {activeTab} for the last 30 days
                </p>

                {/* Tab selector */}
                <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1 gap-1">
                    {(["incidents", "alarms"] as ChartTab[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors
                                ${activeTab === tab
                                ? "bg-white/10 text-white"
                                : "text-white/40 hover:text-white"
                            }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* States */}
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

            {/* Chart */}
            {!loading && !error && (
                <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
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
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={color}
                            strokeWidth={2}
                            fill="url(#colorGradient)"
                            dot={false}
                            activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};

export default IncidentChart;