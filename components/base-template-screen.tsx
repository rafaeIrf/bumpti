import { spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isIOS } from "@/utils";
import { StatusBar } from "expo-status-bar";
import { ReactNode, cloneElement, isValidElement } from "react";
import { RefreshControl, StyleSheet, View, ViewStyle } from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
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

  // Enable keyboard avoiding behavior for the BottomBar (default: false)
  useKeyboardAvoidingView?: boolean;

  // Status bar style (default: 'light')
  statusBarStyle?: "auto" | "inverted" | "light" | "dark";
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
  useKeyboardAvoidingView = false,
}: BaseTemplateScreenProps) {
  const scrollY = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  // Get keyboard height for animating BottomBar
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Animated style for BottomBar - moves up with keyboard
  const bottomBarAnimatedStyle = useAnimatedStyle(() => {
    if (!useKeyboardAvoidingView) {
      return { bottom: 0 };
    }
    // keyboardHeight is negative when keyboard is shown
    return {
      bottom: -keyboardHeight.value,
    };
  });

  // Clone TopHeader and inject scrollY prop if it's a valid React element
  const renderTopHeader = () => {
    if (!TopHeader) return null;

    if (isValidElement(TopHeader)) {
      return cloneElement(TopHeader, { scrollY } as any);
    }

    return TopHeader;
  };

  // Render BottomBar with keyboard animation
  const renderBottomBar = () => {
    if (!BottomBar) return null;

    return (
      <Animated.View
        style={[styles.bottomBarContainer, bottomBarAnimatedStyle]}
        pointerEvents="box-none"
      >
        {BottomBar}
      </Animated.View>
    );
  };

  return (
    <View
      style={[
        styles.wrapper,
        containerStyle,
        { backgroundColor: colors.background },
        // Only add paddingTop if there's no Stack header (Stack header already handles safe area)
        // and if useSafeArea is true
        hasStackHeader || isModal || !useSafeArea
          ? { paddingTop: useSafeArea ? (isIOS ? 16 : insets.top + 16) : 0 }
          : { paddingTop: isIOS ? insets.top : insets.top + 16 },
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
      <View style={{ flex: 1 }}>
        {scrollEnabled ? (
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
          </View>
        ) : (
          <View
            style={{
              flex: 1,
              paddingHorizontal: spacing.md,
              paddingTop: spacing.md,
            }}
          >
            {children}
          </View>
        )}

        {/* Bottom Bar - animated with keyboard */}
        {renderBottomBar()}
      </View>
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
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
});
