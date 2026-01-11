import { Image } from "expo-image";

const prefetchedUrls = new Set<string>();

/**
 * Prefetch a single image URL with memory-disk cache policy
 * Silently fails if prefetch errors
 */
export async function prefetchImage(url: string): Promise<void> {
  try {
    if (prefetchedUrls.has(url)) return;
    await Image.prefetch(url, { cachePolicy: "memory-disk" });
    prefetchedUrls.add(url);
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
  const uniqueUrls = validUrls.filter((url) => !prefetchedUrls.has(url));
  if (uniqueUrls.length === 0) return;

  try {
    // Prefetch first image and wait
    await prefetchImage(uniqueUrls[0]);

    // Prefetch remaining images in parallel (don't wait)
    if (uniqueUrls.length > 1) {
      Promise.all(uniqueUrls.slice(1).map(prefetchImage)).catch(() => {});
    }
  } catch {
    // Silently fail - images will load normally if prefetch fails
  }
}

export function prefetchNextCards(
  deck: Array<{ photos?: string[] }>,
  currentIndex: number,
  windowSize = 6
): void {
  if (deck.length === 0) return;
  if (windowSize <= 0) return;

  const start = Math.min(currentIndex + 1, deck.length);
  const end = Math.min(start + windowSize, deck.length);
  const urls = deck
    .slice(start, end)
    .map((user) => user.photos?.[0])
    .filter((url): url is string => Boolean(url));

  void prefetchImages(urls);
}

export function clearPrefetchCache(): void {
  prefetchedUrls.clear();
}
