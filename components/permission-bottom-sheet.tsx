import { PermissionPromptView } from "@/components/permission-prompt-view";
import React, { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

interface PermissionBottomSheetProps {
  renderIcon: () => ReactNode;
  title: string;
  subtitle: string;
  enableButtonText?: string;
  requestingText?: string;
  isRequesting: boolean;
  canAskAgain: boolean;
  onEnable: () => void;
  onOpenSettings?: () => void; // Optional for tracking permission
  onClose?: () => void; // Optional X close button in top-right corner
}

/**
 * PermissionBottomSheet - Conteúdo para o Bottom Sheet de permissões.
 *
 * Reutiliza o PermissionPromptView para exibir o pedido de permissão
 * dentro de um modal de bottom sheet, permitindo o uso em runtime
 * sem perder o contexto da tela atual.
 */
export function PermissionBottomSheet(props: PermissionBottomSheetProps) {
  return (
    <View style={styles.container}>
      <PermissionPromptView {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24, // Espaço extra para o bottom sheet
    minHeight: 400,
  },
});
