import {
  ArrowLeftIcon,
  CompassIcon,
  MapPinIcon,
  SearchIcon,
} from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Input } from "@/components/ui/search-input";
import useSafeAreaInsets from "@/hooks/use-safe-area-insets";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
//
import { searchPlacesByText as searchPlacesByTextApi } from "@/modules/places/api";
import * as Location from "expo-location";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  TextInput,
  View,
} from "react-native";

export interface PlaceSearchScreenProps {
  onBack: () => void;
  onPlaceSelect: (
    placeId: string,
    placeName: string,
    distance?: number
  ) => void;
  isPremium?: boolean;
}

interface SearchResult {
  placeId: string;
  name: string;
  types: string[];
  formattedAddress?: string;
}

export default function PlaceSearchContent({
  onBack,
  onPlaceSelect,
  isPremium = false,
}: PlaceSearchScreenProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const debounceTimeout = useRef<number | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const sessionTokenRef = useRef<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Get user location on mount
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      let location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    })();
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      debounceTimeout.current = setTimeout(async () => {
        if (query.trim().length < 2) {
          setSearchResults([]);
          setIsSearching(false);
          return;
        }
        if (!userLocation) {
          setIsSearching(false);
          return;
        }
        setIsSearching(true);
        try {
          const res: any = await searchPlacesByTextApi(
            query,
            userLocation.lat,
            userLocation.lng,
            20000
          );
          setSearchResults(
            (res.places || []).map((p: any) => ({
              ...p,
              types: p.types ?? [],
            }))
          );
        } catch {
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 400);
    },
    [userLocation]
  );

  const handleResultPress = (result: SearchResult) => {
    // Limpa o sessionToken ao selecionar um lugar (inicia nova sessão)
    sessionTokenRef.current = null;
    onPlaceSelect(result.placeId, result.name);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    sessionTokenRef.current = null; // Limpa sessionToken ao limpar busca
  };

  // Opcional: pode mapear tipos para emoji se quiser
  const getCategoryIcon = (types: string[]) => {
    if (types.includes("bar")) return "🍷";
    if (types.includes("cafe")) return "☕";
    if (types.includes("night_club")) return "�";
    if (types.includes("university")) return "🎓";
    return "📍";
  };

  const header = useMemo(
    () => (
      <ThemedView
        style={{
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          paddingTop: insets.top,
        }}
      >
        <ThemedView
          style={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 16,
            gap: 12,
          }}
        >
          <ThemedView
            style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <Pressable
              onPress={onBack}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowLeftIcon width={20} height={20} color={colors.text} />
            </Pressable>
            <Input
              ref={inputRef}
              value={searchQuery}
              onChangeText={handleSearch}
              onClear={clearSearch}
              placeholder={
                isPremium ? "Buscar em qualquer cidade..." : "Buscar lugares..."
              }
              leftIcon={SearchIcon}
              showClearButton
            />
          </ThemedView>
          {/* Pode adicionar info de cidade aqui se necessário futuramente */}
        </ThemedView>
      </ThemedView>
    ),
    [colors, isPremium, onBack, searchQuery, handleSearch, insets.top]
  );

  const renderResult = ({ item }: { item: SearchResult; index: number }) => (
    <Pressable onPress={() => handleResultPress(item)}>
      <ThemedView
        style={{
          padding: 16,
          borderRadius: 16,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <ThemedView
          style={{
            width: 72,
            height: 72,
            borderRadius: 12,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ThemedText style={{ fontSize: 28 }}>
            {getCategoryIcon(item.types)}
          </ThemedText>
        </ThemedView>
        <ThemedView style={{ flex: 1, minWidth: 0 }}>
          <ThemedText
            style={{ color: colors.text, fontWeight: "600" }}
            numberOfLines={1}
          >
            {item.name}
          </ThemedText>
          <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>
            {item.formattedAddress}
          </ThemedText>
        </ThemedView>
      </ThemedView>
    </Pressable>
  );

  return (
    <ThemedView style={{ flex: 1, backgroundColor: colors.background }}>
      {header}
      <ThemedView style={{ flex: 1, padding: 16 }}>
        {searchQuery.length === 0 ? (
          <ThemedView style={{ alignItems: "center", marginTop: 48 }}>
            <ThemedView
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <SearchIcon width={40} height={40} color={colors.textSecondary} />
            </ThemedView>
            <ThemedText
              style={{ color: colors.text, fontSize: 18, marginBottom: 4 }}
            >
              Buscar lugares
            </ThemedText>
            <ThemedText
              style={{
                color: colors.textSecondary,
                textAlign: "center",
                maxWidth: 280,
              }}
            >
              {isPremium
                ? "Encontre lugares em qualquer cidade do Brasil"
                : "Encontre bares, cafés, baladas e muito mais"}
            </ThemedText>
            <ThemedView
              style={{ width: "100%", maxWidth: 480, marginTop: 24, gap: 8 }}
            >
              <ThemedText
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  paddingHorizontal: 8,
                }}
              >
                Sugestões de busca:
              </ThemedText>
              {["Bar", "Café", "Balada", "Restaurante"].map((s) => (
                <Pressable key={s} onPress={() => handleSearch(s)}>
                  <ThemedView
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <SearchIcon
                      width={16}
                      height={16}
                      color={colors.textSecondary}
                    />
                    <ThemedText style={{ color: colors.text }}>{s}</ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
          </ThemedView>
        ) : isSearching ? (
          <ThemedView style={{ paddingTop: 16 }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </ThemedView>
        ) : searchResults.length > 0 ? (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.placeId}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            renderItem={renderResult}
          />
        ) : (
          <ThemedView style={{ alignItems: "center", marginTop: 48 }}>
            <ThemedView
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <MapPinIcon width={40} height={40} color={colors.textSecondary} />
            </ThemedView>
            <ThemedText
              style={{ color: colors.text, fontSize: 18, marginBottom: 6 }}
            >
              Nenhum local encontrado
            </ThemedText>
            <ThemedText
              style={{
                color: colors.textSecondary,
                textAlign: "center",
                maxWidth: 280,
                marginBottom: 12,
              }}
            >
              Tente buscar com outro nome ou verifique a ortografia
            </ThemedText>
            <Pressable onPress={clearSearch}>
              <ThemedView
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  backgroundColor: colors.accent,
                  borderRadius: 999,
                }}
              >
                <ThemedText style={{ color: "#fff", fontWeight: "600" }}>
                  Limpar busca
                </ThemedText>
              </ThemedView>
            </Pressable>
          </ThemedView>
        )}
      </ThemedView>

      {showPremiumModal ? (
        <ThemedView
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: 16,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            gap: 12,
          }}
        >
          <ThemedView style={{ alignItems: "center", gap: 8 }}>
            <ThemedView
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CompassIcon width={32} height={32} color="#000" />
            </ThemedView>
            <ThemedText
              style={{ color: colors.text, fontWeight: "600", fontSize: 16 }}
            >
              Busque locais em outras cidades
            </ThemedText>
            <ThemedText
              style={{ color: colors.textSecondary, textAlign: "center" }}
            >
              Descubra pessoas e lugares além da sua cidade com Premium
            </ThemedText>
          </ThemedView>
          <Pressable onPress={() => setShowPremiumModal(false)}>
            <ThemedView
              style={{
                paddingVertical: 14,
                borderRadius: 999,
                backgroundColor: colors.accent,
                alignItems: "center",
              }}
            >
              <ThemedText style={{ color: "#000", fontWeight: "700" }}>
                Ativar Premium
              </ThemedText>
            </ThemedView>
          </Pressable>
          <Pressable onPress={() => setShowPremiumModal(false)}>
            <ThemedText
              style={{
                color: colors.textSecondary,
                textAlign: "center",
                fontWeight: "600",
              }}
            >
              Voltar
            </ThemedText>
          </Pressable>
        </ThemedView>
      ) : null}
    </ThemedView>
  );
}
