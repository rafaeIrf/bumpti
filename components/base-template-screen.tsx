import { spacing } from "@/constants/theme";
import { StatusBar } from "expo-status-bar";
import { ReactNode, cloneElement, isValidElement } from "react";
import { RefreshControl, StyleSheet, View, ViewStyle } from "react-native";
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

  // Whether the screen has a Stack header (e.g., onboarding screens with progress bar)
  // If true, won't add paddingTop for safe area (header already handles it)
  hasStackHeader?: boolean;
  isModal?: boolean;
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
        hasStackHeader || isModal ? undefined : { paddingTop: insets.top },
      ]}
    >
      {/* Always show a light status bar (our theme is dark) */}
      <StatusBar
        style="light"
        hidden={false}
        translucent
        backgroundColor="transparent"
      />
      {/* Top Header with scroll position - positioned absolutely to stay on top */}
      <View style={styles.headerContainer} pointerEvents="box-none">
        {renderTopHeader()}
      </View>

      {/* Scrollable content */}
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          contentContainerStyle,
          // Add extra padding bottom if BottomBar exists
          BottomBar ? styles.contentWithBottomBar : undefined,
        ]}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
      >
        {children}
      </Animated.ScrollView>

      {/* Bottom Bar - positioned absolutely to stay at bottom */}
      {BottomBar && (
        <View style={styles.bottomBarContainer} pointerEvents="box-none">
          {BottomBar}
        </View>
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
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
