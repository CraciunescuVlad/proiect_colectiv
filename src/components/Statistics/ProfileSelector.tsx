import { useEffect, useMemo, useRef, useState } from "react";
import useProfiles, { type ProfileOption } from "../../hooks/useProfiles";

type Props = {
    selectedProfileId: string | null;
    onChange: (profileId: string | null) => void;
};

// Autocomplete search box for picking a viewer profile to filter Statistics by
// Profiles are identified by uuid but displayed by email
// Passing null as selectedProfileId means "all viewers" (no filter applied)
const ProfileSelector = ({ selectedProfileId, onChange }: Props) => {
    const { profiles, loading, error } = useProfiles();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Look up the email matching the currently selected id for display purposes
    const selectedEmail = useMemo(() => {
        if (selectedProfileId === null) {
            return "";
        }
        const match = profiles.find((p) => p.id === selectedProfileId);
        return match?.email ?? "";
    }, [selectedProfileId, profiles]);

    // Keep the input text in sync when the selection changes from outside
    useEffect(() => {
        if (selectedProfileId === null) {
            setQuery("");
            return;
        }
        setQuery(selectedEmail);
    }, [selectedProfileId, selectedEmail]);

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

    // Filter profiles by substring match on email (case-insensitive)
    const filteredProfiles = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (q === "") {
            return profiles.slice(0, 120);
        }
        return profiles
            .filter((p: ProfileOption) => p.email.toLowerCase().includes(q))
            .slice(0, 50);
    }, [query, profiles]);

    const handleSelect = (profile: ProfileOption) => {
        onChange(profile.id);
        setQuery(profile.email);
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
                    if (e.target.value === "") {
                        onChange(null);
                    }
                }}
                onFocus={() => setOpen(true)}
                placeholder={loading ? "Loading viewers..." : "Search a viewer..."}
                disabled={loading || !!error}
                className="w-full bg-[#0a0015] border border-white/10 rounded-lg px-4 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
            />

            {selectedProfileId !== null && (
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
                    {filteredProfiles.length === 0 && (
                        <p className="text-white/40 text-sm px-4 py-2">No viewers found</p>
                    )}
                    {filteredProfiles.map((profile: ProfileOption) => (
                        <button
                            key={profile.id}
                            onClick={() => handleSelect(profile)}
                            className="w-full text-left px-4 py-2 text-white text-sm hover:bg-white/5"
                        >
                            {profile.email}
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

export default ProfileSelector;