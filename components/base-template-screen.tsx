import { spacing } from "@/constants/theme";
import { StatusBar, StatusBarStyle } from "expo-status-bar";
import { ReactNode, cloneElement, isValidElement } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Base template for all screens in the app.
 * Provides automatic header spacing, scrolling, pull-to-refresh, and fixed bottom bar support.
 *
 * Features:
 * - Automatic padding for status bar and header (if TopHeader is provided)
 * - Built-in ScrollView with pull-to-refresh capability
 * - Fixed bottom bar for buttons/actions (BottomBar prop)
 * - Smooth scroll animations via Reanimated
 * - Theme-aware and safe area aware
 *
 * Usage:
 * ```tsx
 * <BaseTemplateScreen
 *   TopHeader={<ScreenToolbar title="My Screen" />}
 *   BottomBar={<Button onPress={handleSave}>Save</Button>}
 *   refreshing={loading}
 *   onRefresh={fetchData}
 * >
 *   <YourContent />
 * </BaseTemplateScreen>
 * ```
 *
 * @param TopHeader - Optional header component rendered at the top with absolute positioning
 * @param BottomBar - Optional bottom bar component rendered at bottom with absolute positioning (great for fixed buttons)
 * @param children - Main scrollable content
 * @param refreshing - Whether refresh indicator is active
 * @param onRefresh - Callback for pull-to-refresh
 * @param scrollEnabled - Enable/disable scrolling (default: true)
 * @param showsVerticalScrollIndicator - Show/hide scroll indicator (default: true)
 * @param containerStyle - Style for main wrapper View
 * @param contentContainerStyle - Style for ScrollView content container
 */
interface BaseTemplateScreenProps {
  // Top header component (usually ScreenToolbar)
  TopHeader?: ReactNode;

  // Bottom bar component (usually fixed buttons)
  BottomBar?: ReactNode;

  // Main content
  children: ReactNode;

  // Refresh control
  refreshing?: boolean;
  onRefresh?: () => void;

  // Styling
  containerStyle?: ViewStyle;
  contentContainerStyle?: ViewStyle;

  // Scroll configuration
  scrollEnabled?: boolean;
  showsVerticalScrollIndicator?: boolean;

  // If true, won't add paddingTop for safe area (header already handles it)
  hasStackHeader?: boolean;
  isModal?: boolean;

  // Whether to apply safe area padding automatically (default: true)
  useSafeArea?: boolean;

  statusBarStyle?: StatusBarStyle;
}

export function BaseTemplateScreen({
  TopHeader,
  BottomBar,
  children,
  refreshing = false,
  onRefresh,
  containerStyle,
  contentContainerStyle,
  scrollEnabled = true,
  showsVerticalScrollIndicator = false,
  hasStackHeader = false,
  isModal = false,
  useSafeArea = true,
  statusBarStyle = "light",
}: BaseTemplateScreenProps) {
  const scrollY = useSharedValue(0);
  const insets = useSafeAreaInsets();

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Clone TopHeader and inject scrollY prop if it's a valid React element
  const renderTopHeader = () => {
    if (!TopHeader) return null;

    if (isValidElement(TopHeader)) {
      return cloneElement(TopHeader, { scrollY } as any);
    }

    return TopHeader;
  };

  return (
    <View
      style={[
        styles.wrapper,
        containerStyle,
        // Only add paddingTop if there's no Stack header (Stack header already handles safe area)
        // and if useSafeArea is true
        hasStackHeader || isModal || !useSafeArea
          ? { paddingTop: useSafeArea ? 16 : 0 }
          : { paddingTop: insets.top },
      ]}
    >
      {/* Always show a light status bar (our theme is dark) */}
      <StatusBar
        style={statusBarStyle}
        hidden={false}
        translucent
        backgroundColor="transparent"
      />
      {/* Top Header with scroll position - positioned absolutely to stay on top */}
      <View style={styles.headerContainer} pointerEvents="box-none">
        {renderTopHeader()}
      </View>

      {/* Scrollable content */}
      {scrollEnabled ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 70 : 0}
        >
          <View style={{ flex: 1 }}>
            <Animated.ScrollView
              style={styles.scrollView}
              contentContainerStyle={[
                styles.contentContainer,
                contentContainerStyle,
              ]}
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              scrollEnabled={scrollEnabled}
              showsVerticalScrollIndicator={showsVerticalScrollIndicator}
              refreshControl={
                onRefresh ? (
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                  />
                ) : undefined
              }
            >
              {children}
            </Animated.ScrollView>
            {/* Bottom Bar - positioned absolutely to stay at bottom */}
          </View>
          {BottomBar && (
            <View style={styles.bottomBarContainer} pointerEvents="box-none">
              {BottomBar}
            </View>
          )}
        </KeyboardAvoidingView>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={
            Platform.OS === "ios" && !scrollEnabled && isModal ? 70 : 0
          }
        >
          <View
            style={{
              flex: 1,
              paddingHorizontal: spacing.md,
              paddingTop: spacing.md,
            }}
          >
            {children}
            {/* Bottom Bar - positioned absolutely to stay at bottom */}
            {BottomBar && (
              <View style={styles.bottomBarContainer} pointerEvents="box-none">
                {BottomBar}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 32,
    paddingHorizontal: spacing.md,
  },
  contentWithBottomBar: {
    paddingBottom: 120, // Extra space for bottom bar
  },
  headerContainer: {},
  bottomBarContainer: {
    zIndex: 10,
  },
});
