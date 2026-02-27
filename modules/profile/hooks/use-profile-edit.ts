import { useAppSelector } from "@/modules/store/hooks";
import { updateProfilePhotosAction } from "@/modules/store/slices/profileActions";
import { useCallback, useRef, useState } from "react";

const MAX_PHOTOS = 9;

export function useProfileEdit() {
  const profile = useAppSelector((state) => state.profile.data);
  const [isUploading, setIsUploading] = useState(false);

  // Keep a ref to current photos to detect additions vs removals/reorders
  const photos = profile?.photos?.map((p) => p.url) || [];

  // Accumulates {localUri: hash} pairs from moderation results during the session
  const photoHashesRef = useRef<Record<string, string>>({});

  const handlePhotoHashesChange = useCallback((newHashes: Record<string, string>) => {
    photoHashesRef.current = { ...photoHashesRef.current, ...newHashes };
  }, []);

  const updatePhotos = async (newPhotos: string[]) => {
    if (!profile) return;
    
    // Enforce max photo limit as a safety guard
    const limitedPhotos = newPhotos.slice(0, MAX_PHOTOS);
    
    // Capture current length BEFORE action updates the store
    const currentPhotosLength = photos.length;
    const isAddition = limitedPhotos.length > currentPhotosLength;

    try {
      if (isAddition) {
        setIsUploading(true);
      }
      
      await updateProfilePhotosAction(limitedPhotos, photoHashesRef.current);
    } catch (error) {
       // Error is handled in the action
    } finally {
      setIsUploading(false);
    }
  };

  return {
    profile,
    photos,
    isUploading,
    updatePhotos,
    handlePhotoHashesChange,
  };
}


