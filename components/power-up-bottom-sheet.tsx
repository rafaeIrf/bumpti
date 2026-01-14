import { XIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { IAP_SKUS } from "@/modules/iap/config";
import { useIAP, useUserSubscription } from "@/modules/iap/hooks";
import { t } from "@/modules/locales";
import { logger } from "@/utils/logger";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgProps } from "react-native-svg";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PowerUpType = "earlyCheckin";

export interface PowerUpOptionConfig {
  quantity: number;
  id: string;
  badgeId?: string;
  isHighlighted?: boolean;
}

interface PowerUpBottomSheetProps {
  readonly translationKey: string;
  readonly powerUpType: PowerUpType;
  readonly icon: React.ComponentType<SvgProps>;
  readonly options: PowerUpOptionConfig[];
  readonly onClose: () => void;
  readonly onPurchaseComplete?: () => void;
  readonly onUpgradeToPremium: () => void;
  readonly iconColor?: string;
  readonly iconBackgroundColor?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SKU Mapping
// ─────────────────────────────────────────────────────────────────────────────

const POWER_UP_SKU_MAP: Record<PowerUpType, Record<string, string>> = {
  earlyCheckin: {
    single: IAP_SKUS.consumables.checkin1,
    bundle: IAP_SKUS.consumables.checkin5,
    max: IAP_SKUS.consumables.checkin10,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function PowerUpBottomSheet({
  translationKey,
  powerUpType,
  icon: Icon,
  options,
  onClose,
  onPurchaseComplete,
  onUpgradeToPremium,
  iconColor,
  iconBackgroundColor,
}: PowerUpBottomSheetProps) {
  const colors = useThemeColors();
  const { products, requestPurchase, purchasing, error } = useIAP();

  const [selectedOptionId, setSelectedOptionId] = useState<string>(() => {
    return options.find((o) => o.isHighlighted)?.id ?? options[0]?.id ?? "";
  });

  const insets = useSafeAreaInsets();
  // Track if we initiated a purchase from this sheet
  const hasPurchaseStarted = useRef(false);
  const { isPremium, showSubscriptionBonus } = useUserSubscription();

  // Watch for purchase completion (purchasing goes from true -> false)
  useEffect(() => {
    if (hasPurchaseStarted.current && !purchasing) {
      // Purchase flow finished (either success or error handled by listener)
      hasPurchaseStarted.current = false;

      if (!error) {
        logger.log("[PowerUp] Purchase completed successfully, closing sheet");
        onPurchaseComplete?.();
      } else {
        logger.warn("[PowerUp] Purchase had error:", error);
      }
    }
  }, [purchasing, error, onPurchaseComplete]);

  // Get the SKU map for this power-up type
  const skuMap = POWER_UP_SKU_MAP[powerUpType] ?? {};

  // Map options to include real prices from the store
  const resolvedOptions = useMemo(() => {
    return options.map((option) => {
      const sku = skuMap[option.id];
      const product = products.find(
        (p) => p.id === sku || (p as any).productId === sku
      );

      // Get price from product or fallback to translation
      const price =
        product?.displayPrice ??
        product?.localizedPrice ??
        (product as any)?.price ??
        t(`${translationKey}.options.${option.id}.price`);

      return {
        ...option,
        sku,
        price,
        subtitle: t(`${translationKey}.options.${option.id}.subtitle`),
        badge: option.badgeId
          ? t(`${translationKey}.badges.${option.badgeId}`)
          : undefined,
      };
    });
  }, [options, products, skuMap, translationKey]);

  const selectedOption = resolvedOptions.find((o) => o.id === selectedOptionId);

  const handlePurchase = async () => {
    if (!selectedOption?.sku) {
      logger.warn(
        "[PowerUp] No SKU found for selected option:",
        selectedOptionId
      );
      return;
    }

    logger.log("[PowerUp] Initiating purchase for SKU:", selectedOption.sku);

    // Mark that we started a purchase from this component
    hasPurchaseStarted.current = true;

    try {
      await requestPurchase(selectedOption.sku);
      // Don't close here - wait for purchaseUpdatedListener to finish validation
      // The useEffect above will handle closing after purchasing becomes false
    } catch (error) {
      hasPurchaseStarted.current = false;
      logger.error("[PowerUp] Purchase initiation failed:", error);
    }
  };

  const isLoading = purchasing;
  const productsLoaded = products.length > 0;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + spacing.xl }]}>
      <Pressable
        onPress={onClose}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t(`${translationKey}.close`)}
        style={styles.closeButton}
        disabled={isLoading}
      >
        <XIcon width={24} height={24} color={colors.textSecondary} />
      </Pressable>

      <View
        style={[
          styles.iconContainer,
          { backgroundColor: iconBackgroundColor ?? colors.accentBlueLight },
        ]}
      >
        <Icon
          width={32}
          height={32}
          color={iconColor ?? colors.accent}
          stroke={iconColor ?? colors.accent}
        />
      </View>

      <ThemedText
        style={[styles.title, typography.heading, { color: colors.text }]}
      >
        {t(`${translationKey}.title`)}
      </ThemedText>

      <ThemedText
        style={[
          styles.subtitle,
          typography.body,
          { color: colors.textSecondary },
        ]}
      >
        {t(`${translationKey}.subtitle`)}
      </ThemedText>

      <View style={styles.optionsList}>
        {resolvedOptions.map((option) => {
          const isSelected = option.id === selectedOptionId;
          return (
            <Pressable
              key={`${option.id}-${option.quantity}`}
              onPress={() => setSelectedOptionId(option.id)}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.optionCard,
                {
                  borderColor: isSelected ? colors.accent : colors.border,
                  backgroundColor: isSelected
                    ? colors.surfaceHover
                    : colors.surface,
                },
                option.isHighlighted &&
                  isSelected && {
                    shadowColor: colors.accent,
                    shadowOpacity: 0.35,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 5,
                  },
                pressed && styles.optionPressed,
                isLoading && styles.optionDisabled,
              ]}
            >
              {option.badge && (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: colors.accent,
                      shadowColor: colors.accent,
                    },
                  ]}
                >
                  <ThemedText
                    style={[typography.caption, { color: colors.background }]}
                  >
                    {option.badge}
                  </ThemedText>
                </View>
              )}

              <View style={styles.optionContent}>
                <View style={styles.optionTextContainer}>
                  <ThemedText
                    style={[
                      typography.body1,
                      { color: colors.text, marginBottom: spacing.xs },
                    ]}
                  >
                    {t(`${translationKey}.optionLabel`, {
                      quantity: option.quantity,
                    })}
                  </ThemedText>
                  <ThemedText
                    style={[
                      typography.caption,
                      {
                        color: option.isHighlighted
                          ? colors.accent
                          : colors.textSecondary,
                      },
                    ]}
                  >
                    {option.subtitle}
                  </ThemedText>
                </View>

                <View style={styles.priceColumn}>
                  {productsLoaded ? (
                    <ThemedText
                      style={[typography.body1, { color: colors.text }]}
                    >
                      {option.price}
                    </ThemedText>
                  ) : (
                    <ActivityIndicator
                      size="small"
                      color={colors.textSecondary}
                    />
                  )}
                  <View
                    style={[
                      styles.radioOuter,
                      {
                        borderColor: isSelected
                          ? colors.accent
                          : colors.textSecondary,
                      },
                    ]}
                  >
                    {isSelected && (
                      <View
                        style={[
                          styles.radioInner,
                          { backgroundColor: colors.accent },
                        ]}
                      />
                    )}
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {!isPremium && showSubscriptionBonus && (
        <ThemedText
          style={[
            styles.premiumHint,
            typography.caption,
            { color: colors.textSecondary },
          ]}
        >
          {t(`${translationKey}.premiumHint`)}
        </ThemedText>
      )}

      <View style={styles.buttonsContainer}>
        <Button
          onPress={handlePurchase}
          fullWidth
          size="lg"
          label={t(`${translationKey}.purchaseCta`, {
            quantity: selectedOption?.quantity ?? 0,
          })}
          loading={isLoading}
          disabled={isLoading || !productsLoaded}
        />
        {!isPremium && showSubscriptionBonus && (
          <Button
            onPress={onUpgradeToPremium}
            fullWidth
            size="lg"
            variant="secondary"
            label={t(`${translationKey}.upgradeCta`)}
            disabled={isLoading}
            style={[
              styles.secondaryButton,
              { borderColor: colors.accent, backgroundColor: colors.surface },
            ]}
            textStyle={{ color: colors.accent }}
          />
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  closeButton: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  title: {
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  optionsList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  optionCard: {
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
  },
  optionPressed: {
    opacity: 0.95,
  },
  optionDisabled: {
    opacity: 0.6,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  optionTextContainer: {
    flex: 1,
  },
  priceColumn: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  premiumHint: {
    textAlign: "center",
    marginBottom: spacing.md,
  },
  buttonsContainer: {
    gap: spacing.sm,
  },
  secondaryButton: {
    borderWidth: 1,
  },
});
