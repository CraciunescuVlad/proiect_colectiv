import { useState } from "react";
import {
    LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import useChartData from "../../hooks/useChartDataStat";

export type LineSeries = {
    dataKey: string;
    color: string;
    label?: string;
};

type Granularity = "day" | "week" | "month";

type Props = {
    endpoint: string;
    title: string;
    series: LineSeries[];
    unit?: string;
    height?: number;
    capitalizeLegend?: boolean;
    from?: Date;
    to?: Date;
    siteId?: string | null;
    assignedTo?: string | null;
};

// Tooltip behavior depends on how many series are rendered
const CustomTooltip = ({ active, payload, label, unit, multi, capitalizeLegend }: any) => {
    if (!active || !payload || !payload.length) {
        return null;
    }

    if (!multi) {
        return (
            <div className="bg-[#0a0015] border border-white/10 rounded-lg px-4 py-3">
                <p className="text-white font-semibold text-sm">
                    {payload[0].value} {unit}
                </p>
                <p className="text-white/40 text-xs">{label}</p>
            </div>
        );
    }

    return (
        <div className="bg-[#0a0015] border border-white/10 rounded-lg px-4 py-3 min-w-[140px]">
            <p className="text-white/40 text-xs mb-2">{label}</p>
            {payload.map((entry: any) => (
                <div key={entry.dataKey} className="flex items-center justify-between gap-3 text-xs">
                    <span
                        className={capitalizeLegend ? "capitalize" : ""}
                        style={{ color: entry.color }}
                    >
                        {entry.dataKey}
                    </span>
                    <span className="text-white font-semibold">{entry.value}</span>
                </div>
            ))}
        </div>
    );
};

// Reusable line chart card; renders one or more lines based on the series prop
// Has a built-in granularity toggle (day / week / month) that controls the x-axis bucketing
const LineChartCard = ({
    endpoint,
    title,
    series,
    unit = "",
    height = 250,
    capitalizeLegend = false,
    from,
    to,
    siteId,
    assignedTo,
}: Props) => {
    const [granularity, setGranularity] = useState<Granularity>("day");
    const { data, loading, error } = useChartData(endpoint, from, to, siteId, assignedTo, granularity);
    const multi = series.length > 1;

    const granularityOptions: { value: Granularity; label: string }[] = [
        { value: "day", label: "Day" },
        { value: "week", label: "Week" },
        { value: "month", label: "Month" },
    ];

    return (
        <div className="border border-white/10 rounded-2xl p-6 w-full">
            <div className="flex items-center justify-between mb-6">
                <p className="text-white/60 text-sm">{title}</p>
                <div className="flex bg-white/5 border border-white/10 rounded-lg p-1 gap-1">
                    {granularityOptions.map((opt) => {
                        const isActive = granularity === opt.value;
                        let buttonClass = "px-3 py-1 text-xs rounded-md transition-colors ";
                        if (isActive) {
                            buttonClass += "bg-white/15 text-white";
                        } else {
                            buttonClass += "text-white/50 hover:text-white";
                        }
                        return (
                            <button
                                key={opt.value}
                                onClick={() => setGranularity(opt.value)}
                                className={buttonClass}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {loading && (
                <div style={{ height }} className="flex items-center justify-center">
                    <p className="text-white/40 text-sm">Loading chart...</p>
                </div>
            )}

            {error && (
                <div style={{ height }} className="flex items-center justify-center">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {!loading && !error && (
                <ResponsiveContainer width="100%" height={height}>
                    <LineChart data={data} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 'auto']} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip unit={unit} multi={multi} capitalizeLegend={capitalizeLegend} />} />

                        {multi && (
                            <Legend
                                iconType="circle"
                                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                                formatter={(value: string) => (
                                    <span className={`${capitalizeLegend ? "capitalize " : ""}text-white/60`}>
                                        {value}
                                    </span>
                                )}
                            />
                        )}

                        {series.map((s) => (
                            <Line
                                key={s.dataKey}
                                type="monotone"
                                dataKey={s.dataKey}
                                stroke={s.color}
                                strokeWidth={2}
                                dot={{ r: 2, fill: s.color, strokeWidth: 0 }}
                                activeDot={multi ? { r: 4 } : { r: 5, fill: s.color, strokeWidth: 0 }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};

export default LineChartCard;