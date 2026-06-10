import { useEffect, useState } from "react";
import { authHeaders } from "../../lib/apiHeaders";
import {
    AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface ChartPoint {
    date: string;
    value: number;
}

interface SiteChartProps {
    siteId: string;
    type: "alarms" | "incidents";
    color: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#0a0015] border border-white/10 rounded-lg px-3 py-2">
                <p className="text-white font-semibold text-xs">{payload[0].value} events</p>
                <p className="text-white/40 text-xs">{label}</p>
            </div>
        );
    }
    return null;
};

const SiteChart = ({ siteId, type, color }: SiteChartProps) => {
    const [data, setData] = useState<ChartPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`http://localhost:3000/map/sites/${siteId}/${type}/chart`, { headers: authHeaders() });
                const json = await res.json();

                // make sure we got an array back
                if (Array.isArray(json)) {
                    setData(json);
                } else {
                    setError(json.message ?? "Unexpected response");
                    setData([]);
                }
            } catch (err) {
                setError("Failed to fetch chart data");
                setData([]);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [siteId, type]);

    if (loading) return <p className="text-white/40 text-xs py-4 text-center">Loading chart...</p>;
    if (error) return <p className="text-red-400 text-xs py-4 text-center">{error}</p>;
    if (data.length === 0) return <p className="text-white/40 text-xs py-4 text-center">No data in last 30 days</p>;

    return (
        <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                <defs>
                    <linearGradient id={`gradient-${type}-${siteId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                    dataKey="date"
                    tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                />
                <YAxis
                    tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={1.5}
                    fill={`url(#gradient-${type}-${siteId})`}
                    dot={false}
                    activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
};

export default SiteChart;