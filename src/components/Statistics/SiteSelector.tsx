import useSites, { type SiteOption } from "../../hooks/useSites";
import SearchableSelector from "./SearchableSelector";

type Props = {
    selectedSiteId: string | null;
    onChange: (siteId: string | null) => void;
};

// Autocomplete search box for picking a site to filter Statistics by
// Sites are identified by a string id (one letter + 3 digits, e.g. "A123")
const SiteSelector = ({ selectedSiteId, onChange }: Props) => {
    const { sites, loading, error } = useSites();

    return (
        <SearchableSelector<SiteOption>
            items={sites}
            selectedId={selectedSiteId}
            onChange={onChange}
            getId={(site) => site.site_id}
            getLabel={(site) => site.site_id}
            loading={loading}
            error={error}
            placeholderIdle="Search a site..."
            placeholderLoading="Loading sites..."
            emptyText="No sites found"
        />
    );
};

export default SiteSelector;