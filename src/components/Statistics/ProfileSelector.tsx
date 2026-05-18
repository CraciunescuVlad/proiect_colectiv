import useProfiles, { type ProfileOption } from "../../hooks/useProfiles";
import SearchableSelector from "./SearchableSelector";

type Props = {
    selectedProfileId: string | null;
    onChange: (profileId: string | null) => void;
};

// Autocomplete search box for picking a viewer profile to filter Statistics by
// Profiles are identified by uuid but displayed by email
const ProfileSelector = ({ selectedProfileId, onChange }: Props) => {
    const { profiles, loading, error } = useProfiles();

    return (
        <SearchableSelector<ProfileOption>
            items={profiles}
            selectedId={selectedProfileId}
            onChange={onChange}
            getId={(profile) => profile.id}
            getLabel={(profile) => profile.email}
            loading={loading}
            error={error}
            placeholderIdle="Search a viewer..."
            placeholderLoading="Loading viewers..."
            emptyText="No viewers found"
        />
    );
};

export default ProfileSelector;