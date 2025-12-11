import { getProfile } from "@/modules/profile/api";
import { setProfile, setProfileLoading } from "@/modules/store/slices/profileActions";
import { calculateAge } from "@/utils/calculate-age";

/**
 * Fetches the user profile from the backend and updates the Redux store.
 * Use this to ensure the profile state is in sync with the server.
 */
export async function fetchAndSetUserProfile() {
  try {
    setProfileLoading(true);
    const data = await getProfile();

    if (!data) {
      setProfile(null);
      return null;
    }

    const profileData = {
      id: data.id,
      name: data.name ?? null,
      birthdate: data.birthdate ?? null,
      gender: data.gender ?? null,
      gender_id: data.gender_id ?? null,
      age_range_min: data.age_range_min ?? null,
      age_range_max: data.age_range_max ?? null,
      age: calculateAge(data.birthdate ?? null),
      connectWith: data.connectWith ?? [],
      intentions: data.intentions ?? [],
      photos: data.photos ?? [],
      updatedAt: data.updated_at ?? null,
      bio: data.bio ?? null,
      favoritePlaces: data.favoritePlaces ?? [],
      height_cm: data.height_cm ?? null,
      job_title: data.job_title ?? null,
      company_name: data.company_name ?? null,
      smoking_key: data.smoking_key ?? null,
      education_key: data.education_key ?? null,
      location: data.location ?? null,
      languages: data.languages ?? [],
      zodiac_key: data.zodiac_key ?? null,
      relationship_key: data.relationship_key ?? null,
    };

    setProfile(profileData);
    return profileData;
  } catch (error) {
    // Re-throw to allow caller to handle headers/error states if needed
    throw error;
  } finally {
    setProfileLoading(false);
  }
}
