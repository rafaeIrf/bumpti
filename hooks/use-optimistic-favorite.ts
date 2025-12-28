import debounce from "lodash/debounce";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface UseOptimisticFavoriteProps {
  initialIsFavorite: boolean;
  placeId: string;
  onToggleFavorite?: (
    placeId: string,
    options?: {
      optimisticOnly?: boolean;
      sync?: boolean;
      value?: boolean;
    }
  ) => void;
}

export function useOptimisticFavorite({
  initialIsFavorite,
  placeId,
  onToggleFavorite,
}: UseOptimisticFavoriteProps) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const tapLockedRef = useRef(false);

  useEffect(() => {
    setIsFavorite(initialIsFavorite);
  }, [initialIsFavorite]);

  const debouncedSync = useMemo(
    () =>
      debounce((pid: string, value: boolean) => {
        onToggleFavorite?.(pid, { sync: true, value });
      }, 500),
    [onToggleFavorite]
  );
  
  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSync.cancel();
    };
  }, [debouncedSync]);

  const lockTap = () => {
    if (tapLockedRef.current) return true;
    tapLockedRef.current = true;
    setTimeout(() => {
      tapLockedRef.current = false;
    }, 300);
    return false;
  };

  const handleToggle = useCallback(
    (event?: any) => {
      event?.stopPropagation();
      if (lockTap()) return;

      const nextValue = !isFavorite;
      setIsFavorite(nextValue);

      onToggleFavorite?.(placeId, { optimisticOnly: true, value: nextValue });

      debouncedSync(placeId, nextValue);
    },
    [isFavorite, onToggleFavorite, placeId, debouncedSync]
  );

  return { isFavorite, handleToggle };
}
