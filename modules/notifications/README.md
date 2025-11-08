# Notification Module

Módulo para gerenciamento de permissões de notificações push no app.

## Estrutura

```
modules/notifications/
├── index.ts          # Funções principais do módulo
└── README.md         # Esta documentação

hooks/
└── use-notification-permission.ts  # React Hook para usar em componentes
```

## Uso

### Hook (Recomendado)

Use o hook `useNotificationPermission` em componentes React:

```tsx
import { useNotificationPermission } from "@/hooks/use-notification-permission";

function MyComponent() {
  const { hasPermission, isLoading, shouldShowScreen, request } =
    useNotificationPermission();

  // Verificar se deve mostrar tela de permissão
  if (shouldShowScreen) {
    router.push("/(onboarding)/notifications");
  }

  // Solicitar permissão
  const handleRequest = async () => {
    const result = await request();
    if (result.status === "granted") {
      // Permissão concedida!
    }
  };

  return (
    <View>
      <Text>Permissão: {hasPermission ? "Sim" : "Não"}</Text>
      <Button onPress={handleRequest}>Permitir Notificações</Button>
    </View>
  );
}
```

### Funções Diretas

Você também pode usar as funções diretamente:

```tsx
import {
  hasNotificationPermission,
  requestNotificationPermission,
  shouldShowNotificationScreen,
  checkNotificationPermission,
} from "@/modules/notifications";

// Verificar se tem permissão
const hasPermission = await hasNotificationPermission();

// Verificar status detalhado
const { status, canAskAgain } = await checkNotificationPermission();

// Solicitar permissão
const result = await requestNotificationPermission();
if (result.status === "granted") {
  console.log("Permissão concedida!");
}

// Verificar se deve mostrar tela de permissão
const shouldShow = await shouldShowNotificationScreen();
```

## API

### Hook: `useNotificationPermission()`

Retorna um objeto com:

- `hasPermission: boolean` - Se a permissão está concedida
- `isLoading: boolean` - Se está carregando/verificando
- `shouldShowScreen: boolean` - Se deve mostrar a tela de permissão
- `request: () => Promise<NotificationPermissionResult>` - Solicita permissão
- `refresh: () => Promise<void>` - Atualiza o status
- `checkPermission: () => Promise<void>` - Verifica permissão novamente

### Funções

#### `checkNotificationPermission()`

Verifica o status atual da permissão.

**Retorno:**

```ts
{
  status: 'granted' | 'denied' | 'undetermined',
  canAskAgain: boolean
}
```

#### `hasNotificationPermission()`

Retorna `true` se a permissão está concedida.

**Retorno:** `Promise<boolean>`

#### `requestNotificationPermission()`

Solicita permissão ao usuário.

**Retorno:**

```ts
{
  status: 'granted' | 'denied' | 'undetermined',
  canAskAgain: boolean
}
```

#### `shouldShowNotificationScreen()`

Verifica se deve mostrar a tela de permissão no onboarding.

**Retorno:** `Promise<boolean>`

- `true` - Deve mostrar a tela (permissão não concedida)
- `false` - Não precisa mostrar (já tem permissão)

#### `configureNotificationHandler()`

Configura o handler de notificações para quando o app está em foreground.

**Uso:**

```tsx
import { configureNotificationHandler } from "@/modules/notifications";

// Chamar uma vez no _layout.tsx ou App.tsx
configureNotificationHandler();
```

#### `getPushNotificationToken()`

Obtém o token do Expo Push Notification para enviar via API.

**Retorno:** `Promise<string | null>`

**Uso:**

```tsx
const token = await getPushNotificationToken();
if (token) {
  // Enviar token para seu backend
  await api.saveDeviceToken(token);
}
```

#### `scheduleLocalNotification(title, body, delaySeconds)`

Agenda uma notificação local.

**Parâmetros:**

- `title: string` - Título da notificação
- `body: string` - Corpo da notificação
- `delaySeconds: number` - Segundos de atraso (0 = imediato)

**Retorno:** `Promise<string | null>` - ID da notificação

**Exemplo:**

```tsx
// Notificação imediata
await scheduleLocalNotification("Bem-vindo!", "Obrigado por se cadastrar", 0);

// Notificação em 1 hora
await scheduleLocalNotification(
  "Lembrete",
  "Volte e confira novos eventos!",
  3600
);
```

#### `cancelAllNotifications()`

Cancela todas as notificações agendadas.

**Uso:**

```tsx
await cancelAllNotifications();
```

## Fluxo de Onboarding

O módulo é usado no fluxo de onboarding para decidir se mostra a tela de permissão:

```tsx
// app/(onboarding)/location.tsx
import { useNotificationPermission } from "@/hooks/use-notification-permission";

export default function LocationScreen() {
  const { shouldShowScreen: shouldShowNotifications } =
    useNotificationPermission();

  const navigateNext = () => {
    if (shouldShowNotifications) {
      // Usuário ainda não permitiu notificações
      router.push("/(onboarding)/notifications");
    } else {
      // Usuário já permitiu, pula para próxima tela
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

## Observações

- ✅ Funciona em iOS e Android
- ✅ Verifica permissão automaticamente
- ✅ Trata erros silenciosamente
- ✅ Detecta se pode pedir permissão novamente
- ⚠️ Push tokens só funcionam em dispositivos físicos (não no simulador)
- ⚠️ Requer `EXPO_PUBLIC_PROJECT_ID` nas variáveis de ambiente para tokens

## Exemplos Completos

### Tela de Onboarding

```tsx
import { useNotificationPermission } from "@/hooks/use-notification-permission";

export default function NotificationsScreen() {
  const { request } = useNotificationPermission();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleEnable = async () => {
    setIsRequesting(true);
    const result = await request();

    if (result.status === "granted") {
      // Salvar no perfil do usuário
      await saveUserPreference({ notificationsEnabled: true });
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
        Permitir Notificações
      </Button>
    </View>
  );
}
```

### Verificar Permissão em Configurações

```tsx
import { useNotificationPermission } from "@/hooks/use-notification-permission";

export default function SettingsScreen() {
  const { hasPermission, isLoading, request, refresh } =
    useNotificationPermission();

  const handleToggle = async () => {
    if (hasPermission) {
      // Redirecionar para configurações do sistema
      Linking.openSettings();
    } else {
      // Tentar solicitar permissão
      const result = await request();
      if (result.status !== "granted" && !result.canAskAgain) {
        // Usuário negou permanentemente, precisa ir nas configurações
        Alert.alert(
          "Ativar nas Configurações",
          "Para receber notificações, ative nas configurações do seu dispositivo.",
          [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Abrir Configurações",
              onPress: () => Linking.openSettings(),
            },
          ]
        );
      }
    }
  };

  useEffect(() => {
    // Atualizar quando a tela ganhar foco
    const unsubscribe = navigation.addListener("focus", () => {
      refresh();
    });
    return unsubscribe;
  }, [refresh]);

  if (isLoading) return <ActivityIndicator />;

  return (
    <View>
      <Switch value={hasPermission} onValueChange={handleToggle} />
      <Text>
        Notificações Push: {hasPermission ? "Ativadas" : "Desativadas"}
      </Text>
    </View>
  );
}
```

## Debugging

Para testar notificações locais:

```tsx
import { scheduleLocalNotification } from "@/modules/notifications";

// Em um botão de teste
<Button
  onPress={async () => {
    await scheduleLocalNotification(
      "Teste",
      "Esta é uma notificação de teste!",
      3 // 3 segundos
    );
  }}
>
  Testar Notificação
</Button>;
```
