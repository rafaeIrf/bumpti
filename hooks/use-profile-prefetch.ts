import { useAppSelector } from "@/modules/store/hooks";
import { prefetchImages } from "@/utils/image-prefetch";
import { useEffect, useMemo } from "react";

/**
 * Hook to prefetch profile images in the background.
 * This should be used at a high level (like TabsLayout) to ensure
 * images are cached before the user navigates to the profile screen.
 */
export function useProfilePrefetch() {
  const profile = useAppSelector((state) => state.profile.data);
  const onboardingUserData = useAppSelector(
    (state) => state.onboarding.userData
  );

  // Aggregate all possible profile photos
  const allProfilePhotos = useMemo(() => {
    const photos =
      profile?.photos?.map((p) => p.url) || onboardingUserData.photoUris || [];
    return photos.filter(Boolean);
  }, [profile?.photos, onboardingUserData.photoUris]);

  // Prefetch images whenever the list changes
  useEffect(() => {
    if (allProfilePhotos.length > 0) {
      prefetchImages(allProfilePhotos);
    }
  }, [allProfilePhotos]);
}
