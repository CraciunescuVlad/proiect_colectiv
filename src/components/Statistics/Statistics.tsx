import { useState } from "react";
import type { DateRange } from "react-day-picker";
import IncidentsLineChart from "./IncidentsLineChart";
import DateRangePicker from "./DateRangePicker";

// Returns a DateRange covering the last 30 days
const getDefaultRange = (): DateRange => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from, to };
};

const Statistics = () => {
    const [range, setRange] = useState<DateRange | undefined>(getDefaultRange());

    return (
        <div className="flex flex-col h-screen bg-[#060010] px-24 py-6 overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-white text-2xl font-semibold">Statistics</h1>
                <DateRangePicker range={range} onChange={setRange} />
            </div>

            {/* Chart */}
            <IncidentsLineChart from={range?.from} to={range?.to} />

        </div>
    );
};

export default Statistics;