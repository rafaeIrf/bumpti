# Location Module

Módulo para gerenciamento de permissões e acesso à localização do usuário.

## Estrutura

```
modules/location/
├── index.ts          # Funções principais do módulo
└── README.md         # Esta documentação

hooks/
└── use-location-permission.ts  # React Hook para usar em componentes
```

## Uso

### Hook (Recomendado)

Use o hook `useLocationPermission` em componentes React:

```tsx
import { useLocationPermission } from "@/hooks/use-location-permission";

function MyComponent() {
  const {
    hasPermission,
    isLoading,
    shouldShowScreen,
    location,
    request,
    getLocation,
  } = useLocationPermission();

  // Verificar se deve mostrar tela de permissão
  if (shouldShowScreen) {
    router.push("/(onboarding)/location");
  }

  // Solicitar permissão
  const handleRequest = async () => {
    const result = await request();
    if (result.status === "granted") {
      // Permissão concedida!
      const coords = await getLocation();
      console.log("Coordinates:", coords);
    }
  };

  return (
    <View>
      <Text>Permissão: {hasPermission ? "Sim" : "Não"}</Text>
      {location && (
        <Text>
          Lat: {location.latitude}, Lon: {location.longitude}
        </Text>
      )}
      <Button onPress={handleRequest}>Permitir Localização</Button>
    </View>
  );
}
```

### Funções Diretas

Você também pode usar as funções diretamente:

```tsx
import {
  hasLocationPermission,
  requestLocationPermission,
  shouldShowLocationScreen,
  getCurrentLocation,
  watchLocation,
  calculateDistance,
} from "@/modules/location";

// Verificar se tem permissão
const hasPermission = await hasLocationPermission();

// Solicitar permissão
const result = await requestLocationPermission();
if (result.status === "granted") {
  console.log("Permissão concedida!");
}

// Obter localização atual
const location = await getCurrentLocation();
console.log(location?.latitude, location?.longitude);

// Observar mudanças de localização
const subscription = await watchLocation(
  (location) => {
    console.log("Nova posição:", location);
  },
  { distanceInterval: 100 } // 100 metros
);

// Cancelar observação
subscription?.remove();

// Calcular distância entre dois pontos
const distance = calculateDistance(lat1, lon1, lat2, lon2);
console.log(`Distância: ${distance} metros`);
```

## API

### Hook: `useLocationPermission()`

Retorna um objeto com:

- `hasPermission: boolean` - Se a permissão está concedida
- `isLoading: boolean` - Se está carregando/verificando
- `shouldShowScreen: boolean` - Se deve mostrar a tela de permissão
- `location: LocationCoordinates | null` - Última localização obtida
- `request: () => Promise<LocationPermissionResult>` - Solicita permissão
- `getLocation: () => Promise<LocationCoordinates | null>` - Obtém localização atual
- `refresh: () => Promise<void>` - Atualiza o status
- `checkPermission: () => Promise<void>` - Verifica permissão novamente

### Tipos

```ts
interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null; // Direção em graus
  speed: number | null; // Velocidade em m/s
}

interface LocationPermissionResult {
  status: "granted" | "denied" | "undetermined";
  canAskAgain: boolean;
}
```

### Funções

#### `checkLocationPermission()`

Verifica o status atual da permissão.

**Retorno:**

```ts
{
  status: 'granted' | 'denied' | 'undetermined',
  canAskAgain: boolean
}
```

#### `hasLocationPermission()`

Retorna `true` se a permissão está concedida.

**Retorno:** `Promise<boolean>`

#### `requestLocationPermission()`

Solicita permissão ao usuário.

**Retorno:**

```ts
{
  status: 'granted' | 'denied' | 'undetermined',
  canAskAgain: boolean
}
```

#### `shouldShowLocationScreen()`

Verifica se deve mostrar a tela de permissão no onboarding.

**Retorno:** `Promise<boolean>`

- `true` - Deve mostrar a tela (permissão não concedida)
- `false` - Não precisa mostrar (já tem permissão)

#### `getCurrentLocation()`

Obtém a localização atual do usuário.

**Retorno:** `Promise<LocationCoordinates | null>`

**Exemplo:**

```tsx
const location = await getCurrentLocation();
if (location) {
  console.log(`Lat: ${location.latitude}, Lon: ${location.longitude}`);
}
```

#### `getLastKnownLocation()`

Obtém a última localização conhecida (mais rápido mas pode estar desatualizada).

**Retorno:** `Promise<LocationCoordinates | null>`

**Exemplo:**

```tsx
const location = await getLastKnownLocation();
// Se não houver última posição, retorna a atual
```

#### `watchLocation(callback, options?)`

Observa mudanças de localização em tempo real.

**Parâmetros:**

- `callback: (location: LocationCoordinates) => void` - Função chamada a cada atualização
- `options?`:
  - `accuracy?: Location.Accuracy` - Precisão desejada
  - `timeInterval?: number` - Intervalo mínimo em ms (padrão: 10000)
  - `distanceInterval?: number` - Distância mínima em metros (padrão: 100)

**Retorno:** `Promise<LocationSubscription | null>`

**Exemplo:**

```tsx
const subscription = await watchLocation(
  (location) => {
    console.log("Nova posição:", location);
    updateMapMarker(location);
  },
  {
    accuracy: Location.Accuracy.High,
    distanceInterval: 50, // Atualizar a cada 50m
    timeInterval: 5000, // Ou a cada 5 segundos
  }
);

// Parar de observar
subscription?.remove();
```

#### `geocodeAddress(address)`

Converte endereço em coordenadas.

**Parâmetros:**

- `address: string` - Endereço para geocodificar

**Retorno:** `Promise<LocationCoordinates | null>`

**Exemplo:**

```tsx
const coords = await geocodeAddress("Times Square, New York");
if (coords) {
  console.log(`Lat: ${coords.latitude}, Lon: ${coords.longitude}`);
}
```

#### `reverseGeocode(latitude, longitude)`

Converte coordenadas em endereço.

**Parâmetros:**

- `latitude: number`
- `longitude: number`

**Retorno:** `Promise<LocationGeocodedAddress | null>`

**Exemplo:**

```tsx
const address = await reverseGeocode(-23.5505, -46.6333);
if (address) {
  console.log(`${address.street}, ${address.city}, ${address.country}`);
}
```

#### `calculateDistance(lat1, lon1, lat2, lon2)`

Calcula distância entre dois pontos em metros (fórmula de Haversine).

**Parâmetros:**

- `lat1, lon1: number` - Coordenadas do primeiro ponto
- `lat2, lon2: number` - Coordenadas do segundo ponto

**Retorno:** `number` - Distância em metros

**Exemplo:**

```tsx
const distance = calculateDistance(
  -23.5505,
  -46.6333, // São Paulo
  -22.9068,
  -43.1729 // Rio de Janeiro
);
console.log(`Distância: ${(distance / 1000).toFixed(0)} km`);
```

## Fluxo de Onboarding

O módulo é usado no fluxo de onboarding para decidir se mostra a tela de permissão:

```tsx
// app/(onboarding)/intention.tsx
import { useLocationPermission } from "@/hooks/use-location-permission";
import { useNotificationPermission } from "@/hooks/use-notification-permission";

export default function IntentionScreen() {
  const { shouldShowScreen: shouldShowLocation } = useLocationPermission();
  const { shouldShowScreen: shouldShowNotifications } =
    useNotificationPermission();

  const navigateNext = () => {
    // Prioridade: Location → Notifications → Complete
    if (shouldShowLocation) {
      router.push("/(onboarding)/location");
    } else if (shouldShowNotifications) {
      router.push("/(onboarding)/notifications");
    } else {
      router.push("/(onboarding)/complete");
    }
  };

  // ... resto do código
}
```

## Status de Permissão

- **`granted`** - Permissão concedida pelo usuário
- **`denied`** - Permissão negada pelo usuário
- **`undetermined`** - Ainda não foi solicitada

## Níveis de Precisão

```tsx
import * as Location from "expo-location";

Location.Accuracy.Lowest; // ~3000m
Location.Accuracy.Low; // ~1000m
Location.Accuracy.Balanced; // ~100m (padrão)
Location.Accuracy.High; // ~10m
Location.Accuracy.Highest; // Melhor possível (~3-5m)
Location.Accuracy.BestForNavigation; // GPS completo
```

## Observações

- ✅ Funciona em iOS e Android
- ✅ Verifica permissão automaticamente
- ✅ Trata erros silenciosamente
- ✅ Detecta se pode pedir permissão novamente
- ✅ Suporta background location (requer configuração adicional)
- ⚠️ GPS consome mais bateria em precisão alta
- ⚠️ Localização interna pode ser imprecisa
- ⚠️ iOS requer descrição de uso no Info.plist

## Exemplos Completos

### Tela de Onboarding

```tsx
import { useLocationPermission } from "@/hooks/use-location-permission";

export default function LocationScreen() {
  const { request, getLocation } = useLocationPermission();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleEnable = async () => {
    setIsRequesting(true);
    const result = await request();

    if (result.status === "granted") {
      // Obter localização inicial
      const coords = await getLocation();

      // Salvar no perfil do usuário
      await saveUserLocation(coords);

      router.push("/next-screen");
    } else {
      Alert.alert(
        "Permissão negada",
        "Você pode ativar depois nas configurações"
      );
    }

    setIsRequesting(false);
  };

  return (
    <View>
      <Button onPress={handleEnable} disabled={isRequesting}>
        Permitir Localização
      </Button>
    </View>
  );
}
```

### Mapa com Localização do Usuário

```tsx
import { useLocationPermission } from "@/hooks/use-location-permission";
import { useEffect, useState } from "react";

export default function MapScreen() {
  const { hasPermission, getLocation } = useLocationPermission();
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    if (hasPermission) {
      loadUserLocation();
    }
  }, [hasPermission]);

  const loadUserLocation = async () => {
    const location = await getLocation();
    setUserLocation(location);
  };

  return (
    <MapView
      initialRegion={{
        latitude: userLocation?.latitude ?? 0,
        longitude: userLocation?.longitude ?? 0,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
    >
      {userLocation && (
        <Marker coordinate={userLocation} title="Você está aqui" />
      )}
    </MapView>
  );
}
```

### Rastreamento em Tempo Real

```tsx
import { watchLocation } from "@/modules/location";
import { useEffect, useState } from "react";

export default function TrackingScreen() {
  const [currentLocation, setCurrentLocation] = useState(null);

  useEffect(() => {
    let subscription;

    const startTracking = async () => {
      subscription = await watchLocation(
        (location) => {
          setCurrentLocation(location);
          console.log("Speed:", location.speed, "m/s");
          console.log("Heading:", location.heading, "degrees");
        },
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10, // Atualizar a cada 10m
        }
      );
    };

    startTracking();

    return () => {
      subscription?.remove();
    };
  }, []);

  return (
    <View>
      <Text>Velocidade: {currentLocation?.speed?.toFixed(1) ?? 0} m/s</Text>
      <Text>Direção: {currentLocation?.heading?.toFixed(0) ?? 0}°</Text>
    </View>
  );
}
```

### Buscar Lugares Próximos

```tsx
import { getCurrentLocation, calculateDistance } from "@/modules/location";

async function findNearbyPlaces() {
  const userLocation = await getCurrentLocation();
  if (!userLocation) return [];

  const places = await fetchPlaces();

  // Adicionar distância e ordenar
  const placesWithDistance = places
    .map((place) => ({
      ...place,
      distance: calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        place.latitude,
        place.longitude
      ),
    }))
    .sort((a, b) => a.distance - b.distance);

  return placesWithDistance;
}

// Uso
const nearbyPlaces = await findNearbyPlaces();
nearbyPlaces.forEach((place) => {
  console.log(`${place.name}: ${(place.distance / 1000).toFixed(1)} km`);
});
```

## Debugging

Para testar localização no simulador/emulador:

**iOS Simulator:**

1. Features → Location → Custom Location
2. Digite lat/lon manualmente
3. Ou use "Apple" para Cupertino, "City Run" para corrida simulada

**Android Emulator:**

1. Extended Controls (⋮)
2. Location
3. Digite lat/lon ou arraste o mapa

**Expo Go:**

```tsx
// Forçar localização de teste (apenas desenvolvimento)
if (__DEV__) {
  const testLocation = {
    latitude: -23.5505,
    longitude: -46.6333,
  };
}
```
