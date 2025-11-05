import i18n from "./i18n";

/**
 * Translates a given key using i18n.
 * Supports nested keys using dot notation (e.g., "common.welcome")
 * and interpolation for dynamic values.
 *
 * @param key - Translation key (e.g., "welcome", "errors.notFound")
 * @param options - Optional parameters for interpolation (e.g., { name: "John" })
 * @returns Translated string or the key itself if translation is not found
 *
 * @example
 * ```ts
 * translate("welcome") // "Bem-vindo!" (pt) or "Welcome!" (en)
 * translate("greeting", { name: "John" }) // "Olá, John!" (if key is "Olá, {{name}}!")
 * ```
 */
export function translate(key: string, options?: Record<string, any>): string {
  return i18n.t(key, options);
}

/**
 * Alias for translate function
 */
export const t = translate;

/**
 * Changes the current language
 * @param language - Language code (e.g., "en", "pt", "es")
 */
export async function changeLanguage(language: string): Promise<void> {
  await i18n.changeLanguage(language);
}

/**
 * Gets the current language code
 * @returns Current language code (e.g., "en", "pt")
 */
export function getCurrentLanguage(): string {
  return i18n.language;
}

/**
 * Checks if a translation key exists
 * @param key - Translation key to check
 * @returns true if the key exists, false otherwise
 */
export function hasTranslation(key: string): boolean {
  return i18n.exists(key);
}

// Re-export i18n instance for advanced usage
export { default as i18n } from "./i18n";
