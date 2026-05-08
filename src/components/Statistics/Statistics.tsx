import { useState } from "react";
import type { DateRange } from "react-day-picker";
import LineChartCard from "./LineChartCard";
import DateRangePicker from "./DateRangePicker";

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
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-white text-2xl font-semibold">Statistics</h1>
                <DateRangePicker range={range} onChange={setRange} />
            </div>

            <div className="flex flex-col gap-6">
                <LineChartCard
                    endpoint="incidents"
                    title="Incidents in the selected range"
                    unit="incidents"
                    color="#f472b6"
                    from={range?.from}
                    to={range?.to}
                />
                <LineChartCard
                    endpoint="alarms"
                    title="Alarms in the selected range"
                    unit="alarms"
                    color="#818cf8"
                    from={range?.from}
                    to={range?.to}
                />
            </div>
        </div>
    );
};

export default Statistics;