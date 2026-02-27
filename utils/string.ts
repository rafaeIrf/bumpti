/**
 * Converts a string to Title Case using Unicode-aware matching:
 * - First word is always capitalized
 * - Words with ≤ 2 chars stay lowercase (e.g. "da", "de", "e", "of", "y")
 * - Accented characters (ã, é, ç, ü…) are handled correctly
 * - `.toLowerCase()` upfront ensures the tail of each word is always lowercase
 *
 * @example toTitleCase("BAR DA ESQUINA")    // "Bar da Esquina"
 * @example toTitleCase("gatÃO da VILA")     // "Gatão da Vila"
 * @example toTitleCase("THE PUB OF LONDON") // "The Pub of London"
 */
export function toTitleCase(str: string): string {
  let isFirst = true;
  return str.toLowerCase().replace(/\p{L}+/gu, (word) => {
    if (isFirst) {
      isFirst = false;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
    return word.length > 2
      ? word.charAt(0).toUpperCase() + word.slice(1)
      : word;
  });
}

/**
 * Extracts and normalizes the first name from a full name string:
 * - Takes only the first word (splits on whitespace)
 * - Capitalizes the first letter and lowercases the rest
 * - Handles accented characters correctly (ã, é, ç…)
 *
 * @example extractFirstName("GustaVo de Souza") // "Gustavo"
 * @example extractFirstName("RAFAEL")           // "Rafael"
 * @example extractFirstName("  ana maria  ")    // "Ana"
 */
export function extractFirstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}
