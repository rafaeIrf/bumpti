import { spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { logger } from "@/utils/logger";
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BackHandler, Keyboard, Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetContext,
  BottomSheetContextValue,
  BSProps,
} from "./context";

export interface BottomSheetProviderProps {
  children?: React.ReactNode;
}

export default function BottomSheetProvider({
  children,
}: BottomSheetProviderProps) {
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState<boolean>(false);
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const screenTitleRef = useRef<string>("");
  const [bsProps, setBSProps] = useState<BSProps | null>(null);

  const handleExpandPress = useCallback((props: BSProps) => {
    dismissKeyboard();
    logger.info("[BottomSheet] Expand requested", {
      draggable: props.draggable,
      snapPoints: props.snapPoints,
    });
    setBSProps(props);
    setIsBottomSheetOpen(true);
  }, []);

  const handleClosePress = useCallback(() => {
    logger.info("[BottomSheet] Close requested");
    setIsBottomSheetOpen(false);
    dismissKeyboard();
    bottomSheetRef.current?.dismiss();
  }, []);

  const colors = useThemeColors();

  useEffect(() => {
    if (bsProps) {
      bottomSheetRef.current?.present();
    }
  }, [bsProps]);

  // Handle Android back button
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isBottomSheetOpen) {
          handleClosePress();
          return true; // Prevent default behavior (exit app)
        }
        return false; // Let default behavior happen
      }
    );

    return () => backHandler.remove();
  }, [isBottomSheetOpen, handleClosePress]);

  const renderBackDrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        style={[props.style, styles.backdrop]}
        opacity={0.48}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        onPress={handleClosePress}
      />
    ),
    [handleClosePress]
  );

  const bottomSheetContext: BottomSheetContextValue = useMemo(
    () => ({
      expand: handleExpandPress,
      close: handleClosePress,
      screenTitle: screenTitleRef,
      isBottomSheetOpen,
    }),
    [isBottomSheetOpen, handleExpandPress, handleClosePress]
  );

  const dismissKeyboard = () => Keyboard.dismiss();

  const isDraggable = bsProps?.draggable || bsProps?.draggable === undefined;
  const snapPoints = bsProps?.snapPoints;
  const enableDynamicSizing = !snapPoints;
  const isFullScreen = snapPoints?.[0] === "100%";

  const insets = useSafeAreaInsets();
  const paddingBottom = Platform.OS === "ios" ? 0 : 24;

  // Para telas fullscreen, não precisa de padding bottom
  const contentPaddingBottom = isFullScreen ? 0 : paddingBottom;

  const handleModalDismiss = useCallback(() => {
    if (bsProps?.onClose) {
      bsProps.onClose();
    }
    setIsBottomSheetOpen(false);
    setBSProps(null);
  }, [bsProps]);

  return (
    <BottomSheetModalProvider>
      <BottomSheetContext.Provider value={bottomSheetContext}>
        {children}
        <BottomSheetModal
          index={0}
          snapPoints={snapPoints}
          enableDynamicSizing={enableDynamicSizing}
          handleIndicatorStyle={styles.handleIndicatorStyle}
          ref={bottomSheetRef}
          enablePanDownToClose={isDraggable}
          enableContentPanningGesture={isDraggable}
          enableHandlePanningGesture={isDraggable}
          handleStyle={styles.componentStyle}
          backgroundStyle={{
            ...styles.bottomSheetBg,
            backgroundColor: colors.surface,
            borderTopRightRadius: isFullScreen ? 0 : spacing.lg,
            borderTopLeftRadius: isFullScreen ? 0 : spacing.lg,
          }}
          backdropComponent={bsProps ? renderBackDrop : undefined}
          animateOnMount
          topInset={isFullScreen ? 0 : undefined}
          android_keyboardInputMode="adjustResize"
          onDismiss={handleModalDismiss}
        >
          {enableDynamicSizing ? (
            <BottomSheetView
              style={[
                styles.dynamicContent,
                { paddingBottom: contentPaddingBottom },
              ]}
            >
              {bsProps?.content()}
            </BottomSheetView>
          ) : (
            <BottomSheetScrollView
              enableFooterMarginAdjustment={true}
              contentContainerStyle={[
                {
                  paddingBottom: contentPaddingBottom,
                },
                snapPoints && { flexGrow: 1 },
              ]}
              showsVerticalScrollIndicator={false}
              style={styles.scrollView}
            >
              {bsProps?.content()}
            </BottomSheetScrollView>
          )}
        </BottomSheetModal>
      </BottomSheetContext.Provider>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  bottomSheetBg: {
    borderTopRightRadius: spacing.lg,
    borderTopLeftRadius: spacing.lg,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  componentStyle: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  handleIndicatorStyle: {
    backgroundColor: "transparent",
  },
  dynamicContent: {},
  scrollView: {
    flex: 1,
  },
});
