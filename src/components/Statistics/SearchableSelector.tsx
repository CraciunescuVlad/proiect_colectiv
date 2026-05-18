import { useEffect, useMemo, useRef, useState } from "react";

type Props<T> = {
    items: T[];
    selectedId: string | null;
    onChange: (id: string | null) => void;
    getId: (item: T) => string;
    getLabel: (item: T) => string;
    loading?: boolean;
    error?: string | null;
    placeholderIdle?: string;
    placeholderLoading?: string;
    emptyText?: string;
    width?: string;
};

// Generic autocomplete search box used to filter pages by a selected item
// Caller controls both the data shape and how each item maps to an id and a display label
const SearchableSelector = <T,>({
    items,
    selectedId,
    onChange,
    getId,
    getLabel,
    loading = false,
    error = null,
    placeholderIdle = "Search...",
    placeholderLoading = "Loading...",
    emptyText = "No results found",
    width = "w-72",
}: Props<T>) => {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Look up the label matching the currently selected id for display in the input
    const selectedLabel = useMemo(() => {
        if (selectedId === null) {
            return "";
        }
        const match = items.find((item) => getId(item) === selectedId);
        if (!match) {
            return "";
        }
        return getLabel(match);
    }, [selectedId, items, getId, getLabel]);

    // Keep the input text in sync when the selection changes from outside
    useEffect(() => {
        if (selectedId === null) {
            setQuery("");
            return;
        }
        setQuery(selectedLabel);
    }, [selectedId, selectedLabel]);

    // Close the dropdown when clicking outside the component
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter items by substring match on the label (case-insensitive)
    const filteredItems = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (q === "") {
            return items.slice(0, 120);
        }
        return items
            .filter((item) => getLabel(item).toLowerCase().includes(q))
            .slice(0, 50);
    }, [query, items, getLabel]);

    const handleSelect = (item: T) => {
        onChange(getId(item));
        setQuery(getLabel(item));
        setOpen(false);
    };

    const handleClear = () => {
        onChange(null);
        setQuery("");
        setOpen(false);
    };

    return (
        <div ref={containerRef} className={`relative ${width}`}>
            <input
                type="text"
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                    if (e.target.value === "") {
                        onChange(null);
                    }
                }}
                onFocus={() => setOpen(true)}
                placeholder={loading ? placeholderLoading : placeholderIdle}
                disabled={loading || !!error}
                className="w-full bg-[#0a0015] border border-white/10 rounded-lg px-4 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
            />

            {selectedId !== null && (
                <button
                    onClick={handleClear}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-sm px-1"
                    title="Clear selection"
                >
                    ×
                </button>
            )}

            {open && !loading && !error && (
                <div className="absolute z-50 mt-1 w-full bg-[#0a0015] border border-white/10 rounded-lg max-h-64 overflow-y-auto">
                    {filteredItems.length === 0 && (
                        <p className="text-white/40 text-sm px-4 py-2">{emptyText}</p>
                    )}
                    {filteredItems.map((item) => (
                        <button
                            key={getId(item)}
                            onClick={() => handleSelect(item)}
                            className="w-full text-left px-4 py-2 text-white text-sm hover:bg-white/5"
                        >
                            {getLabel(item)}
                        </button>
                    ))}
                </div>
            )}

            {error && (
                <p className="text-red-400 text-xs mt-1">{error}</p>
            )}
        </div>
    );
};

export default SearchableSelector;