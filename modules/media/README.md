# Media Module

Módulo reutilizável para seleção de imagens da galeria e câmera usando `expo-image-picker`.

## 📦 Instalação

O módulo já está configurado e usa `expo-image-picker@~17.0.8`.

```bash
npx expo install expo-image-picker
```

## 🎯 Funcionalidades

- ✅ Seleção de imagens da galeria
- ✅ Captura de fotos com câmera
- ✅ Seleção múltipla de imagens
- ✅ Edição/crop de imagens
- ✅ Gerenciamento automático de permissões
- ✅ Configuração de qualidade e aspect ratio
- ✅ Action sheet para escolher entre câmera/galeria
- ✅ TypeScript com tipos completos

## 📚 API

### `pickImageFromLibrary(options?)`

Seleciona uma ou mais imagens da galeria do dispositivo.

```typescript
import { pickImageFromLibrary } from "@/modules/media";

// Seleção simples
const result = await pickImageFromLibrary({
  aspect: [3, 4],
  quality: 0.8,
  allowsEditing: true,
});

if (result.success && result.uri) {
  console.log("Imagem selecionada:", result.uri);
}

// Seleção múltipla
const result = await pickImageFromLibrary({
  allowsMultipleSelection: true,
  selectionLimit: 5,
});

if (result.success && result.uris) {
  console.log("Imagens selecionadas:", result.uris);
}
```

#### Options

```typescript
interface PickImageOptions {
  aspect?: [number, number]; // [width, height], default: [1, 1]
  quality?: number; // 0 to 1, default: 0.8
  allowsEditing?: boolean; // default: true
  allowsMultipleSelection?: boolean; // default: false
  selectionLimit?: number; // default: 1
}
```

#### Result

```typescript
interface PickImageResult {
  success: boolean;
  uri?: string; // Single image URI
  uris?: string[]; // Multiple images URIs
  error?: string; // Error code: 'permission_denied', 'cancelled', etc.
}
```

### `takePhoto(options?)`

Captura uma foto usando a câmera do dispositivo.

```typescript
import { takePhoto } from "@/modules/media";

const result = await takePhoto({
  aspect: [1, 1],
  quality: 0.9,
  allowsEditing: true,
});

if (result.success && result.uri) {
  console.log("Foto capturada:", result.uri);
}
```

### `pickImageWithOptions(options?, translations?)`

Exibe um action sheet para o usuário escolher entre câmera ou galeria.

```typescript
import { pickImageWithOptions } from "@/modules/media";
import { t } from "@/modules/locales";

const result = await pickImageWithOptions(
  {
    aspect: [3, 4],
    quality: 0.8,
  },
  {
    title: t("media.chooseOption"),
    camera: t("media.takePhoto"),
    library: t("media.chooseFromLibrary"),
    cancel: t("common.cancel"),
  }
);

if (result.success && result.uri) {
  console.log("Imagem selecionada:", result.uri);
}
```

### Funções de Permissão

```typescript
import {
  checkMediaLibraryPermission,
  requestMediaLibraryPermission,
  checkCameraPermission,
  requestCameraPermission,
} from "@/modules/media";

// Verificar permissão da galeria
const hasLibraryPermission = await checkMediaLibraryPermission();

// Solicitar permissão da galeria
const granted = await requestMediaLibraryPermission();

// Verificar permissão da câmera
const hasCameraPermission = await checkCameraPermission();

// Solicitar permissão da câmera
const cameraGranted = await requestCameraPermission();
```

## 💡 Exemplos de Uso

### Usando o Hook (Recomendado)

O hook `useImagePicker` facilita o uso nas telas React:

```typescript
import { useImagePicker } from "@/hooks/use-image-picker";
import { Alert } from "react-native";

function MyScreen() {
  const [photoUri, setPhotoUri] = useState<string>();
  const { isLoading, pickFromLibrary, capturePhoto, pickWithOptions } =
    useImagePicker();

  const handleSelectPhoto = async () => {
    const result = await pickFromLibrary({
      aspect: [3, 4],
      quality: 0.8,
    });

    if (result.success && result.uri) {
      setPhotoUri(result.uri);
    } else if (result.error === "permission_denied") {
      Alert.alert("Erro", "Precisamos de permissão");
    }
  };

  return (
    <Button onPress={handleSelectPhoto} disabled={isLoading}>
      {isLoading ? "Carregando..." : "Selecionar Foto"}
    </Button>
  );
}
```

### Exemplo 1: Avatar do perfil

```typescript
import { pickImageWithOptions } from "@/modules/media";
import { t } from "@/modules/locales";

const handleChangeAvatar = async () => {
  const result = await pickImageWithOptions(
    {
      aspect: [1, 1], // Quadrado para avatar
      quality: 0.9,
      allowsEditing: true,
    },
    {
      title: t("profile.changeAvatar"),
      camera: t("common.camera"),
      library: t("common.gallery"),
      cancel: t("common.cancel"),
    }
  );

  if (result.success && result.uri) {
    setAvatarUri(result.uri);
    // Upload to backend...
  }
};
```

### Exemplo 2: Upload múltiplo (como na tela de onboarding)

```typescript
import { pickImageFromLibrary } from "@/modules/media";

const handleAddPhotos = async () => {
  const result = await pickImageFromLibrary({
    aspect: [3, 4],
    quality: 0.8,
    allowsMultipleSelection: true,
    selectionLimit: 9,
  });

  if (result.success && result.uris) {
    setPhotos([...photos, ...result.uris]);
  } else if (result.error === "permission_denied") {
    Alert.alert("Erro", "Precisamos de permissão para acessar suas fotos");
  }
};
```

### Exemplo 3: Captura direta com câmera

```typescript
import { takePhoto } from "@/modules/media";

const handleTakePhoto = async () => {
  const result = await takePhoto({
    aspect: [16, 9],
    quality: 0.95,
    allowsEditing: false,
  });

  if (result.success && result.uri) {
    processPhoto(result.uri);
  }
};
```

## ⚠️ Tratamento de Erros

O módulo retorna códigos de erro específicos:

- `permission_denied`: Usuário negou permissão
- `cancelled`: Usuário cancelou a seleção
- `unknown_error`: Erro desconhecido (veja console.error)

```typescript
const result = await pickImageFromLibrary();

if (!result.success) {
  switch (result.error) {
    case "permission_denied":
      Alert.alert("Erro", "Precisamos de permissão para acessar suas fotos");
      break;
    case "cancelled":
      // Usuário cancelou - não fazer nada
      break;
    default:
      Alert.alert("Erro", "Não foi possível selecionar a imagem");
  }
}
```

## 🔧 Configuração de Permissões

As permissões são solicitadas automaticamente, mas você pode configurá-las no `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-image-picker",
        {
          "photosPermission": "Permitir que $(PRODUCT_NAME) acesse suas fotos",
          "cameraPermission": "Permitir que $(PRODUCT_NAME) acesse sua câmera"
        }
      ]
    ]
  }
}
```

## 📝 Notas

- O módulo gerencia permissões automaticamente
- Todas as funções são async e retornam Promises
- Imagens são retornadas como URIs locais
- Suporta iOS e Android
- TypeScript com tipos completos
