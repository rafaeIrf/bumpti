import { XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { LoadingView } from "@/components/loading-view";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { createVerificationSession } from "@/modules/profile";
import { logger } from "@/utils/logger";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Alert, BackHandler, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

/**
 * Verification WebView Modal
 * 
 * Opens the Didit verification URL in a WebView following official recommendations:
 * https://docs.didit.me/reference/ios-android
 * 
 * This modal handles:
 * - Fetching the verification session from the API
 * - Loading state while fetching
 * - Displaying the verification URL in a WebView
 * - Android back button navigation
 */
export default function VerificationWebViewModal() {
  const router = useRouter();
  const colors = useThemeColors();
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    router.back();
  };

  // Fetch verification session on mount
  useEffect(() => {
    const fetchSession = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        logger.log("[VerificationWebView] Fetching verification session...");
        
        const { verification_url } = await createVerificationSession();
        
        logger.log("[VerificationWebView] Session fetched successfully:", {
          hasUrl: !!verification_url,
        });
        
        setVerificationUrl(verification_url);
      } catch (err: any) {
        logger.error("[VerificationWebView] Error fetching session:", err);
        
        // Handle specific errors
        if (err?.message?.includes("already verified")) {
          Alert.alert(
            t("screens.profile.settingsPage.account.verification.alreadyVerified"),
            "",
            [{ text: t("common.close"), onPress: handleClose }]
          );
          return;
        }
        
        setError(err?.message || t("errors.generic"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, []);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (canGoBack && webViewRef.current) {
          // Go back in WebView history if possible
          webViewRef.current.goBack();
          return true; // Prevent default back behavior
        }
        return false; // Allow default back behavior (close modal)
      }
    );

    return () => backHandler.remove();
  }, [canGoBack]);


  const TopHeader = (
    <ScreenToolbar
      title={t("screens.profile.settingsPage.account.verifyProfile")}
      leftAction={{
        icon: XIcon,
        onClick: handleClose,
        ariaLabel: t("common.close") || "Close",
      }}
    />
  );

  return (
    <BaseTemplateScreen 
      TopHeader={TopHeader}
      isModal
      contentContainerStyle={styles.container}
    >
      {/* Loading state */}
      {isLoading && <LoadingView />}

      {/* Error state */}
      {!isLoading && error && (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      )}

      {/* WebView - only show when URL is loaded */}
      {!isLoading && !error && verificationUrl && (
        <WebView
        ref={webViewRef}
        source={{ uri: verificationUrl }}
        // Make sure to set the user agent to a generic mobile one
        userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        // Mandatory props
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        // Android-specific props
        domStorageEnabled={true}
        // Optional props for performance
        androidHardwareAccelerationDisabled={false}
        androidLayerType="hardware"
        // Navigation state handler
        onNavigationStateChange={(navState) => {
          // Track if WebView can go back
          setCanGoBack(navState.canGoBack);
          
          logger.log("[VerificationWebView] Navigation:", {
            url: navState.url,
            canGoBack: navState.canGoBack,
            canGoForward: navState.canGoForward,
          });
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          logger.error("[VerificationWebView] Error loading:", nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          logger.error("[VerificationWebView] HTTP error:", nativeEvent.statusCode);
        }}
          style={styles.webview}
        />
      )}
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0,
  },
  webview: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    textAlign: "center",
  },
});
