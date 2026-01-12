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
 * - transition: 200ms (smooth fade-in)
 * - placeholder: transparent (avoid black flash)
 */
export function RemoteImage({
  priority = "high",
  cachePolicy = "memory-disk",
  contentFit = "cover",
  transition = 200,
  placeholderContentFit = "cover",
  ...props
}: RemoteImageProps) {
  return (
    <Image
      priority={priority}
      cachePolicy={cachePolicy}
      contentFit={contentFit}
      transition={transition}
      placeholderContentFit={placeholderContentFit}
      {...props}
    />
  );
}
