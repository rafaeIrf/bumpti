import {
  CompassIcon,
  ExclamationCircleIcon,
  LockIcon,
  SparklesIcon,
  UsersIcon,
} from "@/assets/icons";
import { GenericConnectionBottomSheet } from "@/components/generic-connection-bottom-sheet";
import { t } from "@/modules/locales";
import { useCallback, useState } from "react";

export type VenueState =
  | "active"
  | "quiet"
  | "premium"
  | "locked"
  | "alreadyConnected";

interface ConnectionBottomSheetProps {
  readonly venueName: string;
  readonly venueState: VenueState;
  readonly onConnect: () => void | Promise<void>;
  readonly onCancel?: () => void;
  readonly onClose?: () => void;
  readonly onPremiumPress?: () => void | Promise<void>;
  readonly currentVenue?: string; // Nome do local atual onde o usuário está conectado
}

/**
 * ConnectionBottomSheet - Conteúdo específico para conexão em venues
 *
 * Estados suportados:
 * - active: Local com pessoas conectadas agora
 * - quiet: Local vazio, sem conexões ativas
 * - premium: Conexão antecipada (feature Premium)
 * - locked: Local distante (requer Premium)
 * - alreadyConnected: Usuário já está conectado em outro local
 *
 * Este componente contém apenas o conteúdo.
 * Use o hook `useBottomSheet()` do projeto para exibir.
 */
export function ConnectionBottomSheet({
  venueName,
  venueState,
  onConnect,
  onCancel,
  onClose,
  onPremiumPress,
  currentVenue,
}: ConnectionBottomSheetProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPremiumConnecting, setIsPremiumConnecting] = useState(false);

  const handleConnect = useCallback(() => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      const result = onConnect();
      if (result && typeof (result as Promise<void>).then === "function") {
        void (result as Promise<void>).catch(() => {
          setIsConnecting(false);
        });
      }
    } catch (_error) {
      setIsConnecting(false);
    }
  }, [isConnecting, onConnect]);

  const handlePremiumConnect = useCallback(() => {
    if (isPremiumConnecting || !onPremiumPress) return;
    setIsPremiumConnecting(true);
    try {
      const result = onPremiumPress();
      if (result && typeof (result as Promise<void>).then === "function") {
        void (result as Promise<void>).catch(() => {
          setIsPremiumConnecting(false);
        });
      }
    } catch (_error) {
      setIsPremiumConnecting(false);
    }
  }, [isPremiumConnecting, onPremiumPress]);

  // Configuração de conteúdo baseado no estado
  const getContent = () => {
    const primaryButtonState = {
      onClick: handleConnect,
      disabled: isConnecting,
      loading: isConnecting,
    };

    switch (venueState) {
      case "active":
        return {
          title: venueName,
          subtitle: t("venue.connection.active.subtitle"),
          supportText: t("venue.connection.active.supportText"),
          primaryButton: {
            text: t("venue.connection.active.button"),
            ...primaryButtonState,
          },
          icon: UsersIcon,
        };

      case "quiet":
        return {
          title: venueName,
          subtitle: t("venue.connection.quiet.subtitle"),
          supportText: t("venue.connection.quiet.supportText"),
          primaryButton: {
            text: t("venue.connection.quiet.button"),
            ...primaryButtonState,
          },
          secondaryButton: {
            text: t("venue.connection.quiet.buttonSecondary"),
            onClick: onClose || (() => {}),
            variant: "secondary" as const,
          },
          icon: CompassIcon,
        };

      case "premium":
        return {
          title: venueName,
          subtitle: t("venue.connection.premium.subtitle"),
          supportText: t("venue.connection.premium.supportText"),
          primaryButton: {
            text: t("venue.connection.premium.button"),
            ...primaryButtonState,
          },
          microcopy: t("venue.connection.premium.microcopy"),
          icon: SparklesIcon,
        };

      case "locked":
        return {
          title: venueName,
          subtitle: t("venue.connection.locked.subtitle"),
          supportText: t("venue.connection.locked.supportText"),
          primaryButton: {
            text: t("venue.connection.locked.buttonPremium"), // "Enter with Check-in"
            onClick: handlePremiumConnect,
            loading: isPremiumConnecting,
            disabled: isPremiumConnecting,
          },
          secondaryButton: {
            text: t("venue.connection.locked.button"), // "Continue exploring"
            onClick: onClose || (() => {}),
            variant: "secondary" as const,
          },
          icon: LockIcon,
        };

      case "alreadyConnected":
        return {
          title: venueName,
          subtitle: t("venue.connection.alreadyConnected.subtitle", {
            currentVenue,
          }),
          supportText: t("venue.connection.alreadyConnected.supportText"),
          primaryButton: {
            text: t("venue.connection.alreadyConnected.button"),
            ...primaryButtonState,
          },
          secondaryButton: {
            text: t("venue.connection.alreadyConnected.buttonCancel"),
            onClick: onCancel || (() => {}),
            variant: "secondary" as const,
          },
          microcopy: t("venue.connection.alreadyConnected.microcopy"),
          icon: ExclamationCircleIcon,
        };

      default:
        return {
          title: venueName,
          subtitle: t("venue.connection.default.subtitle"),
          primaryButton: {
            text: t("venue.connection.default.button"),
            ...primaryButtonState,
          },
        };
    }
  };

  const content = getContent();

  return (
    <GenericConnectionBottomSheet
      title={content.title}
      subtitle={content.subtitle}
      supportText={content.supportText}
      primaryButton={content.primaryButton}
      secondaryButton={content.secondaryButton}
      microcopy={content.microcopy}
      onClose={onClose}
      Icon={content.icon}
    />
  );
}
