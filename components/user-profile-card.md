# UserProfileCard

Componente de card de perfil de usuário com carrossel de fotos, badges de status e informações detalhadas.

## Funcionalidades

- ✅ **Carrossel de fotos** com navegação por clique (40% esquerda/direita da imagem)
- ✅ **Indicadores de foto** no topo
- ✅ **Badges de status**: "Aqui agora", "Favorito", "Xx aqui"
- ✅ **Informações**: nome, idade, localização, bio
- ✅ **Interesses**: tipo de conexão que o usuário busca
- ✅ **Locais favoritos**: lista de lugares com ícone especial para o local atual
- ✅ **Totalmente internacionalizado** (pt/en/es)
- ✅ **Animações suaves** com Reanimated
- ✅ **Theme-aware** com cores do tema

## Props

```typescript
interface UserProfileCardProps {
  readonly profile: UserProfile;
  readonly currentPlaceId?: string;
  readonly places?: Record<string, PlaceData>;
}

interface UserProfile {
  id: string;
  name: string;
  age: number;
  photos: string[]; // Array de URLs das fotos
  bio: string;
  isHereNow?: boolean; // Badge "Aqui agora"
  favoritePlaces?: string[]; // IDs dos lugares favoritos
  visitedPlacesCount?: Record<string, number>; // Contador de visitas por lugar
  lookingFor?: "friends" | "chat" | "networking" | "meetpeople" | "dating";
  location?: string; // Ex: "Centro, São Paulo"
}

interface PlaceData {
  name: string;
  emoji: string;
}
```

## Uso básico

```tsx
import { UserProfileCard } from "@/components/user-profile-card";

const mockProfile = {
  id: "user123",
  name: "Maria Silva",
  age: 28,
  photos: [
    "https://example.com/photo1.jpg",
    "https://example.com/photo2.jpg",
    "https://example.com/photo3.jpg",
  ],
  bio: "Apaixonada por café e boa conversa. Sempre em busca de novos lugares e pessoas interessantes!",
  isHereNow: true,
  location: "Pinheiros, São Paulo",
  lookingFor: "friends",
  favoritePlaces: ["1", "6"],
  visitedPlacesCount: {
    "1": 12,
    "6": 5,
  },
};

function ExampleScreen() {
  return (
    <View style={{ padding: 16 }}>
      <UserProfileCard
        profile={mockProfile}
        currentPlaceId="1"
        places={{
          "1": { name: "Bar do João", emoji: "🍸" },
          "6": { name: "Café Central", emoji: "☕" },
        }}
      />
    </View>
  );
}
```

## Navegação de fotos

O componente divide a área da imagem em duas zonas invisíveis:

- **40% esquerda**: clique para foto anterior
- **40% direita**: clique para foto seguinte
- **20% centro**: sem ação (evita cliques acidentais)

Não há ícones visíveis - a interação é intuitiva ao tocar nos lados da foto.

## Badges de status

### "Aqui agora" (isHereNow)

Badge azul com indicador pulsante - mostra quando o usuário está no local atual.

### "Favorito" (favoritePlaces)

Badge cinza com estrela - aparece quando o local atual está nos favoritos do usuário.

### "Xx aqui" (visitedPlacesCount)

Badge cinza com ícone de navegação - mostra quantas vezes o usuário visitou o local atual.

## Interesses (lookingFor)

Valores aceitos e suas traduções:

- `friends` → "Fazer novas amizades"
- `chat` → "Conversar e conhecer pessoas"
- `networking` → "Networking profissional"
- `meetpeople` → "Encontrar pessoas novas"
- `dating` → "Encontrar alguém especial"

## Locais favoritos

Os locais favoritos aparecem como chips com emoji e nome. O local atual recebe destaque visual:

- Background azul claro
- Border azul
- Estrela preenchida ao lado do nome

## Traduções

Todas as strings são traduzidas usando o sistema i18n:

```json
{
  "userProfile": {
    "hereNow": "...",
    "favorite": "...",
    "visitCount": "...",
    "nearLocation": "...",
    "interest": "...",
    "favoritePlaces": "...",
    "lookingFor": { ... }
  }
}
```

## Estilização

O componente usa:

- ✅ `spacing` tokens do tema
- ✅ `typography` tokens do tema
- ✅ `useThemeColors()` para cores dinâmicas
- ✅ Aspect ratio 3:4 para fotos
- ✅ Border radius 24px (card arredondado)
- ✅ Sombras e elevação para destaque

## Animações

- **FadeIn/FadeOut** (200ms) ao trocar fotos
- **Indicador pulsante** no badge "Aqui agora"
- Transições suaves entre estados

## Responsividade

O componente se adapta automaticamente à largura da tela:

- Usa `Dimensions.get("window").width` para calcular tamanho
- Padding horizontal de `spacing.lg`
- Imagem ocupa largura total menos padding

## Acessibilidade

- ✅ `hitSlop` de 8px nas áreas de navegação
- ✅ Contrast ratios seguem WCAG
- ✅ Textos legíveis com typography tokens
