import { Image } from "expo-image";

/**
 * Prefetch a single image URL with memory-disk cache policy
 * Silently fails if prefetch errors
 */
export async function prefetchImage(url: string): Promise<void> {
  try {
    await Image.prefetch(url, { cachePolicy: "memory-disk" });
  } catch {
    // Silently fail - image will load normally if prefetch fails
  }
}

/**
 * Prefetch multiple image URLs in parallel
 * First image is awaited, remaining images are prefetched in background
 * Silently fails if prefetch errors
 */
export async function prefetchImages(urls: string[]): Promise<void> {
  if (urls.length === 0) return;

  const validUrls = urls.filter(Boolean);
  if (validUrls.length === 0) return;

  try {
    // Prefetch first image and wait
    await prefetchImage(validUrls[0]);

    // Prefetch remaining images in parallel (don't wait)
    if (validUrls.length > 1) {
      Promise.all(validUrls.slice(1).map(prefetchImage)).catch(() => {});
    }
  } catch {
    // Silently fail - images will load normally if prefetch fails
  }
}
