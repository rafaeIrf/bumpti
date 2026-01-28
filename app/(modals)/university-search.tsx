import { PlaceSearchContent } from "@/components/place-search/place-search-content";
import { logger } from "@/utils/logger";
import { useRouter } from "expo-router";

export default function UniversitySearchModal() {
  const router = useRouter();

  const handleUniversitySelect = (place: {
    id: string;
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
  }) => {
    logger.log("[UniversitySearchModal] Selected university:", place.name);

    // Call the callback from university screen
    // @ts-ignore
    const callback = globalThis.__universitySearchCallback;
    if (typeof callback === "function") {
      callback(place);
    }

    router.back();
  };

  return (
    <PlaceSearchContent
      autoFocus
      isModal
      categoryFilter="university"
      onUniversitySelect={handleUniversitySelect}
    />
  );
}
