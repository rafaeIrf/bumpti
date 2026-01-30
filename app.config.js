module.exports = {
  expo: {
    name: "Bumpti",
    slug: "bumpti",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/bumpti-logo.png",
    scheme: "bumpti",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      usesAppleSignIn: true,
      googleServicesFile: "./GoogleService-Info.plist",
      bundleIdentifier: "com.bumpti",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription:
          "We use your location to show nearby venues.",
        NSPhotoLibraryUsageDescription:
          "Precisamos acessar suas fotos para você adicionar imagens ao seu perfil",
        NSCameraUsageDescription:
          "Precisamos acessar sua câmera para você tirar fotos para o seu perfil",
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
          NSAllowsLocalNetworking: true,
          NSExceptionDomains: {
            "firebaseapp.com": {
              NSIncludesSubdomains: true,
              NSThirdPartyExceptionAllowsInsecureHTTPLoads: true,
            },
            "googleapis.com": {
              NSIncludesSubdomains: true,
              NSThirdPartyExceptionAllowsInsecureHTTPLoads: true,
            },
          },
        },
        LSApplicationQueriesSchemes: ["comgooglemaps", "waze", "maps"],
        GIDClientID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      },
      appleTeamId: "V68Y42WV27",
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#000000",
        foregroundImage: "./assets/images/bumpti-logo.png",
        monochromeImage: "./assets/images/bumpti-logo.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      googleServicesFile: "./google-services.json",
      package: "com.bumpti",
      permissions: ["android.permission.RECORD_AUDIO"],
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-iap",
      "@react-native-google-signin/google-signin",
      "expo-apple-authentication",
      [
        "expo-image-picker",
        {
          photosPermission:
            "Permitir que $(PRODUCT_NAME) acesse suas fotos para você adicionar ao perfil",
          cameraPermission:
            "Permitir que $(PRODUCT_NAME) acesse sua câmera para você tirar fotos",
        },
      ],
      [
        "react-native-bootsplash",
        {
          assetsDir: "assets/bootsplash",
          android: {
            parentTheme: "EdgeToEdge",
            darkContentBarsStyle: true,
          },
        },
      ],
      "expo-localization",
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      "@react-native-firebase/crashlytics",
      "@react-native-firebase/messaging",
      [
        "expo-build-properties",
        {
          android: {
            kotlinVersion: "2.2.0",
            // If you're targeting Expo SDK 54 or newer, confirm whether this manual override is still required.
            // Please share findings with the community at https://github.com/hyochan/expo-iap/discussions.
          },
          ios: {
            useFrameworks: "static",
            buildReactNativeFromSource: true,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "86403ae5-b135-412f-9a73-92b352f9fda5",
      },
    },
    owner: "rafaelrrf",
  },
};
