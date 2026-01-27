/**
 * Version comparison utilities for semantic versioning.
 * Used by the version guard system to compare app versions.
 */

/**
 * Parses a semantic version string into an array of numbers.
 * Handles versions like "1.0.0", "2.1", "1.2.3.4" gracefully.
 *
 * @param version - Semantic version string (e.g., "1.2.3")
 * @returns Array of version numbers [major, minor, patch, ...]
 */
function parseVersion(version: string): number[] {
  return version
    .split(".")
    .map((part) => {
      const num = parseInt(part, 10);
      return isNaN(num) ? 0 : num;
    });
}

/**
 * Compares two semantic version strings.
 * Returns true if `current` is smaller (older) than `target`.
 *
 * Examples:
 * - isVersionSmaller("1.0.0", "1.0.1") -> true
 * - isVersionSmaller("1.0.0", "1.0.0") -> false
 * - isVersionSmaller("2.0.0", "1.9.9") -> false
 * - isVersionSmaller("1.2", "1.2.1") -> true
 *
 * @param current - Current app version
 * @param target - Target version to compare against
 * @returns true if current < target, false otherwise
 */
export function isVersionSmaller(current: string, target: string): boolean {
  const currentParts = parseVersion(current);
  const targetParts = parseVersion(target);

  // Compare up to the maximum length of either version
  const maxLength = Math.max(currentParts.length, targetParts.length);

  for (let i = 0; i < maxLength; i++) {
    const currentPart = currentParts[i] ?? 0;
    const targetPart = targetParts[i] ?? 0;

    if (currentPart < targetPart) {
      return true;
    }
    if (currentPart > targetPart) {
      return false;
    }
    // If equal, continue to next part
  }

  // All parts are equal
  return false;
}

/**
 * Compares two semantic version strings for equality.
 *
 * @param v1 - First version
 * @param v2 - Second version
 * @returns true if versions are equal
 */
export function isVersionEqual(v1: string, v2: string): boolean {
  const parts1 = parseVersion(v1);
  const parts2 = parseVersion(v2);

  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] ?? 0;
    const part2 = parts2[i] ?? 0;

    if (part1 !== part2) {
      return false;
    }
  }

  return true;
}
