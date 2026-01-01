# Instructions for this repo

These guidelines steer GitHub Copilot (Chat and inline suggestions) when generating code and docs in this project.

## Project overview

- Mobile app with Expo (SDK ~54), React Native 0.81, React 19, TypeScript.
- Navigation via Expo Router v6 (file-based routing) — already set up with:
  - Main group: `app/(tabs)` (Tabs)
  - Modal: `app/modal.tsx`
  - Onboarding: `app/(onboarding)` with `welcome.tsx`
  - Flow decision in `app/index.tsx` using AsyncStorage (`hasOnboarded`).
- Theming/style: `ThemedText` and `ThemedView` components, colors in `constants/theme.ts`, icons via `components/ui/icon-symbol`.
- Import alias: use `@/` for internal paths (e.g., `@/components/...`).

## Language and tone

- Write UI strings, comments, and docs in English (US).
- Keep messages short, clear, and consistent with the app's tone.

## Internationalization (i18n)

- **Always use translation keys** for user-facing strings (UI text, labels, messages, etc.).
- Import translation function: `import { translate, t } from "@/modules/locales";`
- Use `translate(key)` instead of hardcoded strings.
- **When adding new text:**
  1. Create a new translation key in all i18n files (`modules/locales/en.json`, `pt.json`, `es.json`)
  2. Use descriptive, dot-notation keys (e.g., `"screens.home.title"`, `"common.welcome"`)
  3. Translate the text appropriately for each language:
     - `en.json` - English (US)
     - `pt.json` - Portuguese (Brazil)
     - `es.json` - Spanish
  4. Use the translation function in code: `t("screens.home.title")`
- **When removing text or features:**
  1. Remove the translation keys from all i18n files (`modules/locales/en.json`, `pt.json`, `es.json`)
  2. Remove the `t()` function calls from the code
  3. Keep locale files synchronized - if a key is removed from one file, remove it from all three
- **Start clean:** If you remove code that uses a translation string, you **MUST** remove the corresponding key from all locale files. Do not leave unused strings.
- **Key naming conventions:**
  - Group by feature/screen: `"screens.explore.subtitle"`
  - Common strings: `"common.save"`, `"common.cancel"`
  - Errors: `"errors.notFound"`, `"errors.network"`
  - Actions: `"actions.delete"`, `"actions.confirm"`
- **Interpolation example:**
  ```json
  // pt.json
  { "greeting": "Olá, {{name}}!" }
  ```
  ```tsx
  // Component
  t("greeting", { name: "João" }); // "Olá, João!"
  ```
- **Never hardcode user-facing text** - always use translation keys.

### i18n Examples:

```tsx
// ❌ Don't - Hardcoded text
<ThemedText>Bem-vindo!</ThemedText>

// ✅ Do - Use translation
import { t } from "@/modules/locales";
<ThemedText>{t("common.welcome")}</ThemedText>

// ✅ With interpolation
<ThemedText>{t("greeting", { name: user.name })}</ThemedText>
```

## Code standards

- Prefer strict TypeScript (explicit types for props and returns).
- Functional components with hooks; avoid classes.
- Follow existing ESLint/Prettier configs (don't reformat unrelated code).
- Avoid unnecessary dependencies; prefer Expo/React Native APIs already present.
- Handle errors safely and quietly when appropriate (concise logs, don't break UI).

## Logging

- **Always use the logger utility** instead of `console.log`, `console.error`, `console.warn`, etc.
- Import: `import { logger } from "@/utils/logger";`
- Available methods: `logger.log()`, `logger.info()`, `logger.warn()`, `logger.error()`, `logger.debug()`
- The logger automatically disables all logs in production builds via `__DEV__` check.
- **Never use console.\* directly** - always use logger methods.

### Logging Examples:

```tsx
// ❌ Don't - Direct console usage
console.log("User logged in:", user);
console.error("Failed to fetch data:", error);

// ✅ Do - Use logger utility
import { logger } from "@/utils/logger";
logger.log("User logged in:", user);
logger.error("Failed to fetch data:", error);
```

## Navigation (Expo Router)

- Prefer Expo Router over direct React Navigation use.
- Rules:
  - To create a screen: add a file under `app/...` and, if needed, a `_layout.tsx` with `<Stack>`/`<Tabs>`.
  - Use `router.push`, `router.replace`, `router.back` for imperative navigation.
  - Modals: files at root (e.g., `app/modal.tsx`) with `options={{ presentation: 'modal' }}` at the root stack.
  - New flows (e.g., auth): create `app/(auth)/...` group and register in `app/_layout.tsx` if needed.
- Initial redirects:
  - Keep logic in `app/index.tsx` to choose between `/(onboarding)` and `/(tabs)` via AsyncStorage (`hasOnboarded`).

### Examples

- Navigate to modal: `router.push('/modal')`
- Go to a specific tab: `router.replace('/(tabs)')`
- Open a screen in a group: `router.push('/(onboarding)/welcome')`

## State and persistence

- Simple persistence: `@react-native-async-storage/async-storage` (already installed).
- Onboarding flag: key `hasOnboarded` with values `'true'`/absent.
- For more complex global state, suggest Zustand only when necessary; avoid Redux by default.

## UI and style

- **Always use theme colors** from `constants/theme.ts` via `useThemeColors()` hook.
  - Available colors: `background`, `surface`, `text`, `textSecondary`, `accent`, `border`, `error`, `success`, etc.
  - Access: `const colors = useThemeColors(); <View style={{ backgroundColor: colors.surface }} />`
  - **Never hardcode colors** unless introducing a new color to the theme.
- **Always use typography** from `constants/theme.ts` for consistent text styling.
  - Import: `import { typography } from "@/constants/theme";`
  - Available styles: `heading`, `subheading`, `body`, `caption`
  - Usage: `<Text style={{ ...typography.body, color: colors.text }}>Title</Text>`
  - **Never override properties that typography already provides** (fontSize, lineHeight, fontFamily, fontWeight, letterSpacing).
  - Typography tokens already include: `fontSize`, `lineHeight`, `fontFamily`, `fontWeight`, `letterSpacing`.
  - **Only override typography properties when absolutely necessary** for specific design requirements.
  - When you need a different size, consider if a different typography token fits better (e.g., use `heading` instead of overriding `body` fontSize).
- **Spacing**: Use values from `spacing` in `constants/theme.ts` (xs, sm, md, lg, xl, xxl).
  - **Never hardcode spacing values** - use spacing tokens for margins, padding, gaps.
- Icons with `IconSymbol` or SVG icons from `@/assets/icons`.
- Haptics with `HapticTab` in tabs.
- Images via `expo-image` and assets in `assets/images`.

### Style Examples:

```tsx
// ❌ Don't - Hardcoded colors, font sizes, and spacing
<Text style={{ color: "#8B98A5", fontSize: 16, marginBottom: 24 }}>Hello</Text>;

// ✅ Do - Use theme colors, typography, and spacing (no overrides)
import { useThemeColors } from "@/hooks/use-theme-colors";
import { typography, spacing } from "@/constants/theme";

const colors = useThemeColors();
<Text
  style={{
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  }}
>
  Hello
</Text>;

// ❌ Don't - Override typography properties unnecessarily
<Text style={{ ...typography.body, fontSize: 18, lineHeight: 24 }}>Text</Text>;

// ✅ Do - Use the appropriate typography token instead
<Text style={{ ...typography.subheading, color: colors.text }}>Text</Text>;

// ⚠️ Only when absolutely necessary - Override with clear reason
// Example: Marketing hero text that needs unique sizing
<Text style={{ ...typography.heading, fontSize: 48 }}>Special Hero Title</Text>;
```

## Screen structure

- **Always use `BaseTemplateScreen`** for new screens (located in `components/base-template-screen.tsx`).
- Pass `TopHeader` prop only if the screen requires a header/toolbar (e.g., with `ScreenToolbar`).
- `BaseTemplateScreen` provides built-in pull-to-refresh support via `refreshing` and `onRefresh` props.
- Wrap screen content inside `BaseTemplateScreen` children.

### Example with header:

```tsx
<BaseTemplateScreen
  TopHeader={
    <ScreenToolbar
      title="Screen Title"
      leftAction={{
        icon: BackIcon,
        onClick: () => router.back(),
        ariaLabel: "Back",
      }}
    />
  }
  refreshing={refreshing}
  onRefresh={handleRefresh}
>
  <ThemedView>{/* Screen content */}</ThemedView>
</BaseTemplateScreen>
```

### Example without header:

```tsx
<BaseTemplateScreen refreshing={refreshing} onRefresh={handleRefresh}>
  <ThemedView>{/* Screen content */}</ThemedView>
</BaseTemplateScreen>
```

## Folder structure (suggestions)

- `app/` — file-based routes. Group segments with parentheses: `(tabs)`, `(onboarding)`, `(auth)`, etc.
- `components/` — shared components. Prefer domain-based subfolders as it grows.
- `hooks/` — reusable hooks (e.g., `use-color-scheme`, `use-theme-color`).
- `constants/` — themes, tokens, and simple configs.

## Testing (when requested)

- Unit: React Native Testing Library + Jest (only when asked).
- E2E: Detox (optional; do not auto-configure without a request).

## Builds and scripts

- Do not change existing EAS Build scripts unless necessary.
- Development: prefer `npm run android/ios/web` and `npm run start`.

## Generation best practices

- Do not leak secrets or credentials.
- Do not reference native APIs unavailable in Expo Managed without plugin/config.
- Prefer Expo APIs (Linking, Image, Haptics, WebBrowser, SplashScreen, etc.).
- For animations, use `react-native-reanimated` v4 as already installed.
- Export as default in new components when there's a single primary entity per file.

## CRITICAL: Non-negotiable rules for EVERY screen/component

When creating or modifying ANY screen or component, you MUST:

0.  **Logging - ALWAYS REQUIRED:**

    - ❌ NEVER use `console.log`, `console.error`, `console.warn`, `console.info`, or `console.debug` directly
    - ✅ ALWAYS use the logger utility from `@/utils/logger`
    - ✅ Import: `import { logger } from "@/utils/logger";`
    - ✅ Use appropriate method: `logger.log()`, `logger.error()`, `logger.warn()`, `logger.info()`, `logger.debug()`
    - The logger is automatically disabled in production builds
    - Example:

      ```tsx
      // ❌ WRONG - Direct console usage
      console.log("Fetching data...");
      console.error("API error:", error);

      // ✅ CORRECT - Using logger
      import { logger } from "@/utils/logger";
      logger.log("Fetching data...");
      logger.error("API error:", error);
      ```

1.  **i18n (Internationalization) - ALWAYS REQUIRED:**

    - ❌ NEVER hardcode user-facing text in any language (PT, EN, ES, etc.)
    - ✅ ALWAYS use `t("translation.key")` for ALL user-facing strings
    - ✅ ALWAYS add translation keys to ALL three locale files: `pt.json`, `en.json`, `es.json`
    - ✅ Import: `import { t } from "@/modules/locales";`
    - Example:

      ```tsx
      // ❌ WRONG - Hardcoded text
      <ThemedText>Configurações</ThemedText>
      <ThemedText>Settings</ThemedText>

      // ✅ CORRECT - Using translation
      import { t } from "@/modules/locales";
      <ThemedText>{t("screens.profile.settings")}</ThemedText>
      ```

2.  **Typography - ALWAYS REQUIRED:**

    - ❌ NEVER hardcode fontSize, lineHeight, fontWeight, fontFamily, letterSpacing
    - ✅ ALWAYS use typography tokens: `typography.heading`, `typography.subheading`, `typography.body`, `typography.caption`
    - ✅ Import: `import { typography, spacing } from "@/constants/theme";`
    - ✅ ONLY override when absolutely necessary with clear comment explaining why
    - Example:

      ```tsx
      // ❌ WRONG - Hardcoded typography
      <Text style={{ fontSize: 20, fontWeight: "600", lineHeight: 28 }}>
        Title
      </Text>;

      // ✅ CORRECT - Using typography token
      import { typography } from "@/constants/theme";
      <ThemedText style={typography.heading}>Title</ThemedText>;
      ```

3.  **Theme Colors - ALWAYS REQUIRED:**

    - ❌ NEVER hardcode colors like `#FFFFFF`, `#000000`, `rgb(...)`, etc.
    - ✅ ALWAYS use `useThemeColors()` hook for colors
    - ✅ Available colors: `background`, `surface`, `text`, `textSecondary`, `accent`, `border`, `error`, `success`
    - Example:

      ```tsx
      // ❌ WRONG - Hardcoded color
      <View style={{ backgroundColor: "#1a1a1a" }} />;

      // ✅ CORRECT - Using theme color
      import { useThemeColors } from "@/hooks/use-theme-colors";
      const colors = useThemeColors();
      <View style={{ backgroundColor: colors.surface }} />;
      ```

4.  **Spacing - ALWAYS REQUIRED:**

    - ❌ NEVER hardcode spacing values like `margin: 16`, `padding: 24`, etc.
    - ✅ ALWAYS use spacing tokens: `spacing.xs`, `spacing.sm`, `spacing.md`, `spacing.lg`, `spacing.xl`, `spacing.xxl`
    - Example:

      ```tsx
      // ❌ WRONG - Hardcoded spacing
      <View style={{ marginBottom: 24, paddingHorizontal: 16 }} />;

      // ✅ CORRECT - Using spacing tokens
      import { spacing } from "@/constants/theme";
      <View
        style={{ marginBottom: spacing.lg, paddingHorizontal: spacing.md }}
      />;
      ```

5.  **Loading State - ALWAYS REQUIRED:**

    - ❌ NEVER use `ActivityIndicator` directly or build custom loading views inline.
    - ✅ ALWAYS use `LoadingView` component from `@/components/loading-view`.
    - ✅ Import: `import { LoadingView } from "@/components/loading-view";`
    - Example:

      ```tsx
      // ❌ WRONG - Inline ActivityIndicator
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>;

      // ✅ CORRECT - Using LoadingView
      import { LoadingView } from "@/components/loading-view";
      if (isLoading) return <LoadingView />;
      ```

6.  **Structure and Styles - ALWAYS REQUIRED:**

    - ❌ NEVER use inline styles for static layout/spacing/sizing.
    - ✅ ALWAYS define styles using `const styles = StyleSheet.create({...})` at the end of the file.
    - ✅ ONLY use inline styles for dynamic values (e.g. `colors` from hook, animations).
    - Example:

           ```tsx
           // ❌ WRONG - Inline styles
           <View style={{ padding: 16, marginTop: 10 }} />

           // ✅ CORRECT - StyleSheet
           <View style={styles.container} />

           const styles = StyleSheet.create({
             container: {
               padding: 16,
               marginTop: 10,
             },
           });
           ```

      **IF YOU VIOLATE THESE RULES, THE CODE WILL BE REJECTED. NO EXCEPTIONS.**

**REMINDER: NEVER use console.log/error/warn - ALWAYS use logger from @/utils/logger**

## Quick Do/Don't

- Do: use `@/` for internal imports, type routes/params, keep style consistency.
- Do: create new route groups with `_layout.tsx` when needed.
- Don’t: use raw React Navigation if Expo Router suffices.
- Don’t: add heavy libs without justification.

## Prompts to ask Copilot

- "Create a new screen in `(onboarding)` named `permissions.tsx` with a continue button and update the flow."
- "Add a `Profile` tab in `(tabs)` with an icon and a link to `modal`."
- "Implement a `useOnboarding` hook that reads/writes the `hasOnboarded` flag."

These instructions apply to this repository. When proposing larger changes (structure, dependencies), Copilot should explain the impact and propose atomic commits.
