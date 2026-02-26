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
