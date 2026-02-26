/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

const tintColorLight = "#0a7ea4";

export const Colors = {
  light: {
    // Main palette
    background: "#000000", // Fundo principal
    surface: "#16181C", // Cards, superfícies elevadas
    surfaceHover: "#1C1F23", // Estado hover de superfícies
    border: "#2F3336", // Bordas, separadores

    // Text colors
    text: "#E7E9EA", // Texto principal
    textPrimary: "#E7E9EA",
    textSecondary: "#8B98A5",
    textTertiary: "#5B6671",
    disabled: "#3A3C40",

    // Accent/action
    accent: "#1D9BF0", // Botões primários, links
    accentBlue: "#1D9BF0",
    accentBlueHover: "#1A8CD8",
    accentBlueLight: "rgba(29, 155, 240, 0.1)",
    accentBlueLighter: "rgba(29, 155, 240, 0.05)",

    // State
    error: "#FF453A",
    success: "#00BA7C",
    disabledBG: "#0E0F10",

    // Additional
    plansBlue: "#00A8E8",
    premiumGold: "#FFD700",
    premiumOrange: "#FFA500",
    premiumBlue: "#2997FF",
    premiumBlueDark: "#003E7F",
    cardGradientStart: "#1C1C1C",
    cardGradientEnd: "#0F0F0F",
    accentBorderFaint: "rgba(41, 151, 255, 0.15)",

    // Chart colors
    chart1: "#1D9BF0",
    chart2: "#00BA7C",
    chart3: "#F91880",
    chart4: "#FFD400",
    chart5: "#794BC4",

    // Tab icons
    icon: "#8B98A5",
    tabIconDefault: "#8B98A5",
    tabIconSelected: "#1D9BF0",

    // Legacy/compat
    tint: "#1D9BF0",
    white: "#E7E9EA",

    
    // Pastel Palette (Categories)
    pastelTeal: "#4DB6AC",
    pastelCoral: "#FF8A65",
    pastelPink: "#F06292",
    pastelRed: "#EF5350",
    pastelPurple: "#9575CD",
    pastelCocoa: "#A1887F", 
    pastelBlue: "#64B5F6",
    pastelGreen: "#81C784",
    pastelLime: "#AED581",
    pastelOrange: "#FFB74D",
    pastelLavender: "#BA68C8",
    pastelCyan: "#4DD0E1",
    pastelGold: "#FDD835",
    pastelMagenta: "#F48FB1",
  },
  dark: {
    // Main palette
    background: "#000000", // Fundo principal
    surface: "#16181C", // Cards, superfícies elevadas
    surface1: "#0F0F0F", // Cards, superfícies elevadas
    surfaceHover: "#1C1F23", // Estado hover de superfícies
    border: "#2F3336", // Bordas, separadores

    // Text colors
    text: "#E7E9EA", // Texto principal
    textPrimary: "#E7E9EA",
    textSecondary: "#8B98A5",
    textTertiary: "#5B6671",
    disabled: "#3A3C40",

    // Accent/action
    accent: "#1D9BF0", // Botões primários, links
    accentBlue: "#1D9BF0",
    accentBlueHover: "#1A8CD8",
    accentBlueLight: "rgba(29, 155, 240, 0.1)",
    accentBlueLighter: "rgba(29, 155, 240, 0.05)",

    // State
    error: "#FF453A",
    success: "#00BA7C",
    disabledBG: "#0E0F10",

    // Additional
    plansBlue: "#00A8E8",
    premiumGold: "#FFD700",
    premiumOrange: "#FFA500",
    premiumBlue: "#2997FF",
    premiumBlueDark: "#003E7F",
    cardGradientStart: "#1C1C1C",
    cardGradientEnd: "#0F0F0F",
    accentBorderFaint: "rgba(41, 151, 255, 0.15)",

    // Chart colors
    chart1: "#1D9BF0",
    chart2: "#00BA7C",
    chart3: "#F91880",
    chart4: "#FFD400",
    chart5: "#794BC4",

    // Tab icons
    icon: "#8B98A5",
    tabIconDefault: "#8B98A5",
    tabIconSelected: "#1D9BF0",

    // Legacy/compat
    tint: "#1D9BF0",
    white: "#E7E9EA",

    // Pastel Palette (Categories)
    pastelTeal: "#4DB6AC",
    pastelCoral: "#FF8A65",
    pastelPink: "#F06292",
    pastelRed: "#EF5350",
    pastelPurple: "#8C76C7",
    pastelPurple1: "#8195C7",
    pastelCocoa: "#9E8B80", 
    pastelBlue: "#6FA8DC",
    pastelGreen: "#4FAEA4",
    pastelLime: "#AED581",
    pastelOrange: "#FFB74D",
    pastelLavender: "#BA68C8",
    pastelCyan: "#4DD0E1",
    pastelGold: "#FDD835",
    pastelMagenta: "#F48FB1",
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const typography = {
  heading: { fontFamily: "Poppins-SemiBold", fontSize: 24, lineHeight: 32 },
  heading1: { fontFamily: "Poppins-Bold", fontSize: 24, lineHeight: 32 },
  heading2: { fontFamily: "Poppins-Regular", fontSize: 24, lineHeight: 32 },
  subheading: { fontFamily: "Poppins-Medium", fontSize: 18, lineHeight: 24 },
  subheading1: { fontFamily: "Poppins-Regular", fontSize: 18, lineHeight: 24 },
  subheading2: { fontFamily: "Poppins-Bold", fontSize: 18, lineHeight: 24 },
  body: { fontFamily: "Poppins-Regular", fontSize: 16, lineHeight: 22 },
  body1: { fontFamily: "Poppins-SemiBold", fontSize: 16, lineHeight: 22 },
  body2: { fontFamily: "Poppins-Bold", fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: "Poppins-Regular", fontSize: 12, lineHeight: 18 },
  captionBold: { fontFamily: "Poppins-SemiBold", fontSize: 12, lineHeight: 18 },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
