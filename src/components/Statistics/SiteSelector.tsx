import { useEffect, useMemo, useRef, useState } from "react";
import useSites, { type SiteOption } from "../../hooks/useSites";

type Props = {
    selectedSiteId: string | null;
    onChange: (siteId: string | null) => void;
};

// Autocomplete search box for picking a site to filter Statistics by
// Sites are identified by a string id (one letter + 3 digits, e.g. "A123")
// Passing null as selectedSiteId means "all sites" (no filter applied)
const SiteSelector = ({ selectedSiteId, onChange }: Props) => {
    const { sites, loading, error } = useSites();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Keep the input text in sync when the selected site changes from outside
    useEffect(() => {
        if (selectedSiteId === null) {
            setQuery("");
            return;
        }
        setQuery(selectedSiteId);
    }, [selectedSiteId]);

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

    // Filter sites by substring match on site_id (case-insensitive)
    const filteredSites = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (q === "") {
            return sites.slice(0, 120);
        }
        return sites
            .filter((s: SiteOption) => s.site_id.toLowerCase().includes(q))
            .slice(0, 50);
    }, [query, sites]);

    const handleSelect = (siteId: string) => {
        onChange(siteId);
        setQuery(siteId);
        setOpen(false);
    };

    const handleClear = () => {
        onChange(null);
        setQuery("");
        setOpen(false);
    };

    return (
        <div ref={containerRef} className="relative w-72">
            <input
                type="text"
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                    // If user clears the input manually, also clear the filter
                    if (e.target.value === "") {
                        onChange(null);
                    }
                }}
                onFocus={() => setOpen(true)}
                placeholder={loading ? "Loading sites..." : "Search a site..."}
                disabled={loading || !!error}
                className="w-full bg-[#0a0015] border border-white/10 rounded-lg px-4 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
            />

            {selectedSiteId !== null && (
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
                    {filteredSites.length === 0 && (
                        <p className="text-white/40 text-sm px-4 py-2">No sites found</p>
                    )}
                    {filteredSites.map((site: SiteOption) => (
                        <button
                            key={site.site_id}
                            onClick={() => handleSelect(site.site_id)}
                            className="w-full text-left px-4 py-2 text-white text-sm hover:bg-white/5"
                        >
                            {site.site_id}
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

export default SiteSelector;