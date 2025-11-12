import {
  BeerIcon,
  CoffeeIcon,
  DumbbellIcon,
  FlameIcon,
  MapPinIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { CategoryCard } from "@/components/category-card";
import { ConnectedBar } from "@/components/connected-bar";
import { ConnectionBottomSheet } from "@/components/connection-bottom-sheet";
import { GenericConfirmationBottomSheet } from "@/components/generic-confirmation-bottom-sheet";
import { PlaceCardFeatured } from "@/components/place-card-featured";
import PlaceSearchContent from "@/components/place-search-content";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { router } from "expo-router";
import React, { useState } from "react";
import { FlatList, StyleSheet } from "react-native";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";

interface ActivePlace {
  id: string;
  name: string;
  type: string;
  category: string;
  distance: number;
  activeUsers: number;
}

interface Category {
  id: string;
  icon: React.ComponentType<{ width: number; height: number; color: string }>;
  title: string;
  description: string;
  gradient: [string, string];
  types: string[];
  categoryIcon: string;
}

const categories: Category[] = [
  {
    id: "nightlife",
    icon: BeerIcon,
    title: "Rolês & Noitadas",
    description: "Pra sair e conhecer gente nova.",
    gradient: ["#F39C12", "#D35400"],
    types: ["bar", "night_club"],
    categoryIcon: "🍸",
  },
  {
    id: "cafes",
    icon: CoffeeIcon,
    title: "Cafés & Bate-Papo",
    description: "Lugares pra conversar e relaxar.",
    gradient: ["#8E6E53", "#5C4033"],
    types: ["cafe"],
    categoryIcon: "☕",
  },
  {
    id: "university",
    icon: MapPinIcon,
    title: "Vida Universitária",
    description: "Onde os encontros acontecem na rotina.",
    gradient: ["#3498DB", "#2C3E50"],
    types: ["university"],
    categoryIcon: "🎓",
  },
  {
    id: "fitness",
    icon: DumbbellIcon,
    title: "Bem-estar & Movimento",
    description: "Conexões que começam no treino.",
    gradient: ["#27AE60", "#145A32"],
    types: ["gym"],
    categoryIcon: "🏋️",
  },
];

// Mock de lugares com pessoas conectadas agora
const mockActivePlaces: ActivePlace[] = [
  {
    id: "place-1",
    name: "Bar do Zeca",
    type: "bar",
    category: "bar",
    distance: 0.8,
    activeUsers: 12,
  },
  {
    id: "place-2",
    name: "Café Aurora",
    type: "cafe",
    category: "cafe",
    distance: 1.2,
    activeUsers: 7,
  },
  {
    id: "place-3",
    name: "Universidade Mackenzie",
    type: "university",
    category: "university",
    distance: 2.5,
    activeUsers: 23,
  },
  {
    id: "place-4",
    name: "Balada Fusion",
    type: "nightclub",
    category: "nightclub",
    distance: 1.8,
    activeUsers: 34,
  },
  {
    id: "place-5",
    name: "Academia Smart Fit",
    type: "gym",
    category: "gym",
    distance: 0.5,
    activeUsers: 15,
  },
];

export default function HomeScreen() {
  const colors = useThemeColors();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activePlaces] = useState<ActivePlace[]>(mockActivePlaces);
  const [refreshing, setRefreshing] = useState(false);
  const [connectedVenue, setConnectedVenue] = useState<string | null>(
    "Bar do Zeca"
  ); // Mock: usuário conectado
  const bottomSheet = useCustomBottomSheet();

  const handleCategoryClick = (category: Category) => {
    setSelectedCategory(category.id);
    router.push({
      pathname: "/main/category-results",
      params: {
        categoryName: category.title,
        placeTypes: category.types.join(","),
        isPremium: "false", // TODO: Get from user premium status
      },
    });
    setSelectedCategory(null);
  };

  const handlePlaceClick = (place: ActivePlace) => {
    if (!bottomSheet) return;

    bottomSheet.expand({
      content: () => (
        <ConnectionBottomSheet
          venueName={place.name}
          venueState="active"
          onConnect={() => {
            console.log("Connected to:", place.name);
            bottomSheet.close();
            // TODO: Implement connection logic
          }}
          onCancel={() => {
            bottomSheet.close();
          }}
          onClose={() => {
            bottomSheet.close();
          }}
        />
      ),
      draggable: true,
    });
  };

  const handleLeaveVenue = () => {
    if (!bottomSheet) return;

    bottomSheet.expand({
      content: () => (
        <GenericConfirmationBottomSheet
          title={t("connectedBar.leaveConfirmation.title")}
          description={t("connectedBar.leaveConfirmation.description")}
          icon={MapPinIcon}
          primaryButton={{
            text: t("connectedBar.leaveConfirmation.disconnect"),
            onClick: () => {
              setConnectedVenue(null);
              bottomSheet.close();
              console.log("Disconnected from venue");
            },
            variant: "danger",
          }}
          secondaryButton={{
            text: t("connectedBar.leaveConfirmation.cancel"),
            onClick: () => bottomSheet.close(),
            variant: "secondary",
          }}
          onClose={() => bottomSheet.close()}
        />
      ),
      draggable: true,
      snapPoints: ["45%"],
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // TODO: Fetch real data
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const renderActivePlace = ({
    item,
    index,
  }: {
    item: ActivePlace;
    index: number;
  }) => (
    <Animated.View
      entering={FadeInRight.delay(index * 100).springify()}
      style={{ marginRight: 12 }}
    >
      <PlaceCardFeatured
        place={item}
        onClick={() => handlePlaceClick(item)}
        index={index}
      />
    </Animated.View>
  );

  const handleOpenSearch = () => {
    if (!bottomSheet) return;
    bottomSheet.expand({
      content: () => (
        <PlaceSearchContent
          onBack={() => bottomSheet.close()}
          onPlaceSelect={() => bottomSheet.close()}
          isPremium={false}
        />
      ),
      draggable: true,
      snapPoints: ["100%"],
    });
  };

  return (
    <BaseTemplateScreen
      TopHeader={
        <ThemedView>
          <ScreenToolbar
            leftAction={{
              icon: SlidersHorizontalIcon,
              onClick: () => {},
              ariaLabel: "Voltar",
              color: colors.icon,
            }}
            title="Explorar"
            titleIcon={MapPinIcon}
            titleIconColor={colors.accent}
            rightActions={[
              {
                icon: SearchIcon,
                onClick: handleOpenSearch,
                ariaLabel: "Buscar",
                color: colors.icon,
              },
            ]}
          />
        </ThemedView>
      }
      refreshing={refreshing}
      onRefresh={handleRefresh}
    >
      <ThemedView>
        {/* Connected Bar */}
        {connectedVenue && (
          <ConnectedBar venueName={connectedVenue} onLeave={handleLeaveVenue} />
        )}

        <Animated.View entering={FadeInDown.delay(0).springify()}>
          <ThemedView style={styles.section}>
            <ThemedView style={styles.sectionHeader}>
              <FlameIcon width={18} height={18} color={colors.error} />
              <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                Lugares com pessoas agora
              </ThemedText>
            </ThemedView>

            {activePlaces.length > 0 ? (
              <FlatList
                horizontal
                data={activePlaces}
                renderItem={renderActivePlace}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
              />
            ) : (
              <ThemedView
                style={[
                  styles.emptyCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <ThemedText
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  Ainda não há pessoas conectadas por perto. Que tal ser o
                  primeiro a aparecer? 👀
                </ThemedText>
              </ThemedView>
            )}
          </ThemedView>
        </Animated.View>

        {/* Title Section */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <ThemedView style={[styles.section, { paddingTop: 8 }]}>
            <ThemedText style={[styles.mainTitle, { color: colors.text }]}>
              Onde você quer se conectar hoje?
            </ThemedText>
            <ThemedText
              style={[styles.mainSubtitle, { color: colors.textSecondary }]}
            >
              Escolha o tipo de lugar e descubra quem está por lá.
            </ThemedText>
          </ThemedView>
        </Animated.View>

        {/* Categories List */}
        <ThemedView style={styles.categoriesContainer}>
          {categories.map((category, index) => {
            const isSelected = selectedCategory === category.id;

            return (
              <Animated.View
                key={category.id}
                entering={FadeInDown.delay(300 + index * 100).springify()}
              >
                <CategoryCard
                  category={category}
                  isSelected={isSelected}
                  onClick={() => handleCategoryClick(category)}
                />
              </Animated.View>
            );
          })}
        </ThemedView>

        {/* Info Card */}
        <Animated.View entering={FadeInDown.delay(700).springify()}>
          <ThemedView style={styles.section}>
            <ThemedView
              style={[
                styles.infoCard,
                {
                  borderColor: colors.border,
                },
              ]}
            >
              <ThemedView style={styles.infoContent}>
                <ThemedView
                  style={[
                    styles.infoIconContainer,
                    { backgroundColor: `${colors.accent}10` },
                  ]}
                >
                  <MapPinIcon width={20} height={20} color={colors.accent} />
                </ThemedView>
                <ThemedView style={styles.infoTextContainer}>
                  <ThemedText
                    style={[styles.infoTitle, { color: colors.text }]}
                  >
                    Como funciona?
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.infoDescription,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Escolha uma categoria e veja lugares próximos onde você pode
                    se conectar com outras pessoas.
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            </ThemedView>
          </ThemedView>
        </Animated.View>
      </ThemedView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  headerSubtitle: {
    fontSize: 14,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  section: {
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    ...typography.subheading,
    fontSize: 18,
    fontWeight: "600",
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 16,
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 22,
  },
  mainTitle: {
    ...typography.subheading,
    marginBottom: 8,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  mainSubtitle: {
    ...typography.caption,
    paddingHorizontal: 16,
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 16,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 24,
  },
  infoContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
});
