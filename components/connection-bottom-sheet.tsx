import { GenericConnectionBottomSheet } from "@/components/generic-connection-bottom-sheet";
import { t } from "@/modules/locales";

export type VenueState =
  | "active"
  | "quiet"
  | "premium"
  | "locked"
  | "alreadyConnected";

interface ConnectionBottomSheetProps {
  readonly venueName: string;
  readonly venueState: VenueState;
  readonly onConnect: () => void;
  readonly onCancel?: () => void;
  readonly onClose?: () => void;
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
  currentVenue,
}: ConnectionBottomSheetProps) {
  // Configuração de conteúdo baseado no estado
  const getContent = () => {
    switch (venueState) {
      case "active":
        return {
          title: venueName,
          subtitle: t("venue.connection.active.subtitle"),
          supportText: t("venue.connection.active.supportText"),
          primaryButton: {
            text: t("venue.connection.active.button"),
            onClick: onConnect,
          },
          microcopy: t("venue.connection.active.microcopy"),
        };

      case "quiet":
        return {
          title: venueName,
          subtitle: t("venue.connection.quiet.subtitle"),
          supportText: t("venue.connection.quiet.supportText"),
          primaryButton: {
            text: t("venue.connection.quiet.button"),
            onClick: onConnect,
          },
          microcopy: t("venue.connection.quiet.microcopy"),
        };

      case "premium":
        return {
          title: venueName,
          subtitle: t("venue.connection.premium.subtitle"),
          supportText: t("venue.connection.premium.supportText"),
          primaryButton: {
            text: t("venue.connection.premium.button"),
            onClick: onConnect,
          },
          microcopy: t("venue.connection.premium.microcopy"),
        };

      case "locked":
        return {
          title: venueName,
          subtitle: t("venue.connection.locked.subtitle"),
          supportText: t("venue.connection.locked.supportText"),
          primaryButton: {
            text: t("venue.connection.locked.button"),
            onClick: onConnect,
          },
          microcopy: t("venue.connection.locked.microcopy"),
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
            onClick: onConnect,
          },
          secondaryButton: {
            text: t("venue.connection.alreadyConnected.buttonCancel"),
            onClick: onCancel || (() => {}),
            variant: "secondary" as const,
          },
          microcopy: t("venue.connection.alreadyConnected.microcopy"),
        };

      default:
        return {
          title: venueName,
          subtitle: t("venue.connection.default.subtitle"),
          primaryButton: {
            text: t("venue.connection.default.button"),
            onClick: onConnect,
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
    />
  );
}
