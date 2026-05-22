import useSites, { type SiteOption } from "../../hooks/useSites";
import SearchableSelector from "./SearchableSelector";

type Props = {
    selectedSiteIds: string[];
    onChange: (siteIds: string[]) => void;
};

// Autocomplete search box for picking one or more sites to filter Statistics by
// Sites are identified by a string id (one letter + 3 digits, e.g. "A123")
const SiteSelector = ({ selectedSiteIds, onChange }: Props) => {
    const { sites, loading, error } = useSites();

    return (
        <SearchableSelector<SiteOption>
            multiple
            items={sites}
            selectedIds={selectedSiteIds}
            onChange={onChange}
            getId={(site) => site.site_id}
            getLabel={(site) => site.site_id}
            loading={loading}
            error={error}
            placeholderIdle="Search sites..."
            placeholderLoading="Loading sites..."
            emptyText="No sites found"
        />
    );
};

export default SiteSelector;