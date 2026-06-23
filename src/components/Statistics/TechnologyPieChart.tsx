import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import useTechnologyDistribution from "../../hooks/useTechnologyDistribution";

type Props = {
    endpoint: string;
    title: string;
    from?: Date;
    to?: Date;
    siteIds?: string[];
    assignedTo?: string | null;

};

// Color palette used for the slices
const COLORS = ["#f472b6", "#818cf8", "#facc15", "#4ade80", "#fb923c", "#60a5fa", "#ef4444", "#a78bfa"];

/**
 * Custom tooltip showing slice name, value and percentage of total
 * @param active Whether the tooltip is currently active
 * @param payload Recharts payload containing the hovered slice data
 * @param total The sum of all slice values, used to compute the percentage
 */
const CustomTooltip = ({ active, payload, total }: any) => {
    if (active && payload && payload.length) {
        const entry = payload[0];
        const percent = total > 0 ? (entry.value / total) * 100 : 0;
        return (
            <div className="bg-[#0a0015] border border-white/10 rounded-lg px-4 py-3">
                <p className="text-white font-semibold text-sm">{entry.name}</p>
                <p className="text-white/60 text-xs">{entry.value} ({percent.toFixed(1)}%)</p>
            </div>
        );
    }
    return null;
};

/**
 * Pie chart showing distribution of a metric by technology
 * @param endpoint API endpoint that returns the distribution data
 * @param title Title displayed above the chart
 * @param from Optional start date of the range filter
 * @param to Optional end date of the range filter
 * @param siteIds Optional list of site ids to filter by
 * @param assignedTo Optional profile id to filter incidents assigned to
 */
const TechnologyPieChart = ({ endpoint, title, from, to, siteIds, assignedTo }: Props) => {
    const { data, loading, error } = useTechnologyDistribution(endpoint, from, to, siteIds, assignedTo);
    const total = data.reduce((sum, item) => sum + item.value, 0);
    return (
        <div className="border border-white/10 rounded-2xl p-6 w-full">
            <div className="flex items-center justify-between mb-6">
                <p className="text-white/60 text-sm">{title}</p>
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

            {!loading && !error && data.length === 0 && (
                <div className="h-[300px] flex items-center justify-center">
                    <p className="text-white/40 text-sm">No data in selected range</p>
                </div>
            )}

            {!loading && !error && data.length > 0 && (
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            stroke="none"
                        >
                            {data.map((_, index) => (
                                <Cell key={index} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip total={total}/>} />
                        <Legend
                            iconType="circle"
                            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                            formatter={(value: string) => (
                                <span className="text-white/60">{value}</span>
                            )}
                        />
                    </PieChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};

export default TechnologyPieChart;