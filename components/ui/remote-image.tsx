import { Image, ImageProps } from "expo-image";

interface RemoteImageProps extends ImageProps {
  // Re-export ImageProps from expo-image
}

/**
 * A wrapper around expo-image's Image component with default optimized props.
 * Always has:
 * - cachePolicy: "memory-disk"
 * - priority: "high"
 * - contentFit: "cover" (unless overridden)
 * - transition: 0 (default)
 */
export function RemoteImage({
  priority = "high",
  cachePolicy = "memory-disk",
  contentFit = "cover",
  ...props
}: RemoteImageProps) {
  return (
    <Image
      priority={priority}
      cachePolicy={cachePolicy}
      contentFit={contentFit}
      {...props}
    />
  );
}
