import { useEffect, useMemo, useRef, useState } from "react";

type SingleProps<T> = {
    multiple?: false;
    selectedId: string | null;
    onChange: (id: string | null) => void;
};

type MultiProps = {
    multiple: true;
    selectedIds: string[];
    onChange: (ids: string[]) => void;
};

type CommonProps<T> = {
    items: T[];
    getId: (item: T) => string;
    getLabel: (item: T) => string;
    loading?: boolean;
    error?: string | null;
    placeholderIdle?: string;
    placeholderLoading?: string;
    emptyText?: string;
    width?: string;
};

type Props<T> = CommonProps<T> & (SingleProps<T> | MultiProps);

// Generic autocomplete search box used to filter pages by one or more items
// Caller controls both the data shape and how each item maps to an id and a display label
// When multiple=true, selection is an array and the input is used purely as a search field
const SearchableSelector = <T,>(props: Props<T>) => {
    const {
        items,
        getId,
        getLabel,
        loading = false,
        error = null,
        placeholderIdle = "Search...",
        placeholderLoading = "Loading...",
        emptyText = "No results found",
        width = "w-72",
    } = props;

    const isMulti = props.multiple === true;

    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Look up the label matching the currently selected id (single mode only)
    const selectedLabel = useMemo(() => {
        if (isMulti) {
            return "";
        }
        const singleProps = props as CommonProps<T> & SingleProps<T>;
        if (singleProps.selectedId === null) {
            return "";
        }
        const match = items.find((item) => getId(item) === singleProps.selectedId);
        if (!match) {
            return "";
        }
        return getLabel(match);
    }, [isMulti, props, items, getId, getLabel]);

    // Keep the input text in sync with the selection (single mode only)
    useEffect(() => {
        if (isMulti) {
            return;
        }
        const singleProps = props as CommonProps<T> & SingleProps<T>;
        if (singleProps.selectedId === null) {
            setQuery("");
            return;
        }
        setQuery(selectedLabel);
    }, [isMulti, props, selectedLabel]);

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
        const id = getId(item);

        if (isMulti) {
            const multiProps = props as CommonProps<T> & MultiProps;
            if (multiProps.selectedIds.includes(id)) {
                multiProps.onChange(multiProps.selectedIds.filter((x) => x !== id));
            } else {
                multiProps.onChange([...multiProps.selectedIds, id]);
            }
            setQuery("");
            return;
        }

        const singleProps = props as CommonProps<T> & SingleProps<T>;
        singleProps.onChange(id);
        setQuery(getLabel(item));
        setOpen(false);
    };

    const handleClear = () => {
        if (isMulti) {
            const multiProps = props as CommonProps<T> & MultiProps;
            multiProps.onChange([]);
        } else {
            const singleProps = props as CommonProps<T> & SingleProps<T>;
            singleProps.onChange(null);
        }
        setQuery("");
        setOpen(false);
    };

    // Decide whether to show the clear (×) button
    let hasSelection = false;
    if (isMulti) {
        hasSelection = (props as CommonProps<T> & MultiProps).selectedIds.length > 0;
    } else {
        hasSelection = (props as CommonProps<T> & SingleProps<T>).selectedId !== null;
    }

    // Highlights items already selected in multi mode
    const isItemSelected = (item: T): boolean => {
        if (!isMulti) {
            return false;
        }
        return (props as CommonProps<T> & MultiProps).selectedIds.includes(getId(item));
    };

    return (
        <div ref={containerRef} className={`relative ${width}`}>
            <input
                type="text"
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                    if (!isMulti && e.target.value === "") {
                        const singleProps = props as CommonProps<T> & SingleProps<T>;
                        singleProps.onChange(null);
                    }
                }}
                onFocus={() => setOpen(true)}
                placeholder={loading ? placeholderLoading : placeholderIdle}
                disabled={loading || !!error}
                className="w-full bg-[#0a0015] border border-white/10 rounded-lg px-4 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
            />

            {hasSelection && (
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
                    {filteredItems.map((item) => {
                        const selected = isItemSelected(item);
                        let buttonClass = "w-full text-left px-4 py-2 text-sm flex items-center justify-between ";
                        if (selected) {
                            buttonClass += "bg-white/10 text-white";
                        } else {
                            buttonClass += "text-white hover:bg-white/5";
                        }
                        return (
                            <button
                                key={getId(item)}
                                onClick={() => handleSelect(item)}
                                className={buttonClass}
                            >
                                <span>{getLabel(item)}</span>
                                {selected && <span className="text-white/60 text-xs">✓</span>}
                            </button>
                        );
                    })}
                </div>
            )}

            {error && (
                <p className="text-red-400 text-xs mt-1">{error}</p>
            )}
        </div>
    );
};

export default SearchableSelector;