/**
 * Central utils barrel export
 * Import utilities from a single entry point
 *
 * @example
 * import { isIOS, openTermsOfUse, getAppVersion } from '@/utils'
 */

// Platform utilities
export { isAndroid, isIOS, platformSelect, platformStyles } from "./platform";

// App information
export {
  getAppName,
  getAppVersion,
  getBuildNumber,
  getBundleId,
  getFullVersion,
  isDevelopment,
} from "./app-info";

// External linking
export {
  getBumptiUrls,
  openEmail,
  openInstagram,
  openPhone,
  openPrivacyPolicy,
  openSMS,
  openSupport,
  openTermsOfUse,
  openWebsite,
  share,
} from "./linking";

