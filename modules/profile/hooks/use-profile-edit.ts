import { useAppSelector } from "@/modules/store/hooks";
import { updateProfilePhotosAction } from "@/modules/store/slices/profileActions";
import { useState } from "react";

export function useProfileEdit() {
  const profile = useAppSelector((state) => state.profile.data);
  const [isUploading, setIsUploading] = useState(false);

  // Keep a ref to current photos to detect additions vs removals/reorders
  const photos = profile?.photos?.map((p) => p.url) || [];

  
  // Sync ref with photos only if length changes significantly or we want to track it
  // But wait, if we use ref to compare with "newPhotos", we need the state *before* the update.
  // The 'photos' variable here is from the store, so it updates as soon as optimistic update happens.
  // However, inside updatePhotos, 'photos' (captured in closure or ref) will be the 'current' state before we call the action? 
  // No, React state updates. We need a ref to track what we "had".
  
  // Actually simpler: we can just use the current profile from the hook scope *before* we dispatch.
  // BUT, updatePhotos is async.
  
  // Let's rely on the passed 'newPhotos' vs 'photos' (current state).
  
  const updatePhotos = async (newPhotos: string[]) => {
    if (!profile) return;
    
    // Check if it's an addition
    const isAddition = newPhotos.length > photos.length;

    try {
      if (isAddition) {
        setIsUploading(true);
      }
      
      await updateProfilePhotosAction(newPhotos);
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
  };
}


