import { StatusBar } from "expo-status-bar";
import { ReactNode, cloneElement, isValidElement } from "react";
import { RefreshControl, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";

interface BaseTemplateScreenProps {
  // Top header component (usually ScreenToolbar)
  TopHeader?: ReactNode;

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
}

export function BaseTemplateScreen({
  TopHeader,
  children,
  refreshing = false,
  onRefresh,
  containerStyle,
  contentContainerStyle,
  scrollEnabled = true,
  showsVerticalScrollIndicator = true,
}: BaseTemplateScreenProps) {
  const scrollY = useSharedValue(0);

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
    <View style={[styles.wrapper, containerStyle]}>
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
        contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
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
    paddingTop: 112, // Space for toolbar (64px content + 48px status bar)
    paddingBottom: 32,
  },
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
