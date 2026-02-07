/**
 * Personal data detection utilities
 * Detects phone numbers and external links to protect user privacy
 */

const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}/g;
const URL_REGEX = /https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9]+\.(com|net|org|io|me|br|co)[^\s]*/gi;

/**
 * Checks if text contains personal data (phone numbers or external links)
 */
export function containsPersonalData(text: string): boolean {
  return PHONE_REGEX.test(text) || URL_REGEX.test(text);
}
