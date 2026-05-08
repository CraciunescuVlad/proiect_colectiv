import { useState, useRef, useEffect } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { Calendar, ChevronDown } from "lucide-react";
import "react-day-picker/dist/style.css";
import "./datepicker.css";
type Props = {
    range: DateRange | undefined;
    onChange: (range: DateRange | undefined) => void;
};

// Formats a date as "DD MMM" (e.g. "08 May")
const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

// Button + popover that lets the user pick a start and end date
const DateRangePicker = ({ range, onChange }: Props) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close the popover when clicking outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const label = range?.from && range?.to
        ? `${formatDate(range.from)} – ${formatDate(range.to)}`
        : "Select range";

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
                <Calendar size={16} />
                {label}
                <ChevronDown size={16} />
            </button>

            {open && (
                <div className="absolute right-0 mt-2 z-50 bg-[#0a0015] border border-white/10 rounded-xl p-4 shadow-x">
                    <DayPicker
                        mode="range"
                        selected={range}
                        onSelect={onChange}
                        numberOfMonths={2}
                        showOutsideDays
                        classNames={{
                            months: "flex flex-row gap-6"
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default DateRangePicker;