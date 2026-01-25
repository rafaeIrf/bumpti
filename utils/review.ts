import { logger } from "@/utils/logger";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

const REVIEW_REQUESTED_KEY = "@bumpti:review_requested";
const REVIEW_DELAY_MS = 3000; // 3 seconds delay after match

/**
 * Solicita review do app após o primeiro match do usuário
 * 
 * Regras:
 * - Só solicita uma vez (guarda flag no AsyncStorage)
 * - Aguarda 3 segundos após o match para não interromper a celebração
 * - Usa API nativa do iOS/Android (StoreReview)
 * - Falha silenciosamente se não disponível
 */
export async function requestReviewAfterFirstMatch(): Promise<void> {
  try {
    // Verificar se já solicitou review antes
    const hasRequested = await AsyncStorage.getItem(REVIEW_REQUESTED_KEY);
    
    if (hasRequested === "true") {
      logger.log("Review already requested, skipping");
      return;
    }

    // Verificar se review está disponível no dispositivo
    const isAvailable = await StoreReview.isAvailableAsync();
    
    if (!isAvailable) {
      logger.warn("In-app review not available on this device");
      // Marcar como solicitado mesmo assim para não tentar novamente
      await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, "true");
      return;
    }

    // Aguardar alguns segundos para não interromper a experiência do match
    logger.log(`Waiting ${REVIEW_DELAY_MS}ms before requesting review...`);
    
    setTimeout(async () => {
      try {
        logger.log("Requesting in-app review after first match");
        await StoreReview.requestReview();
        
        // Marcar como solicitado
        await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, "true");
        logger.log("Review requested successfully");
      } catch (error) {
        logger.error("Error requesting review:", error);
        // Marcar como solicitado mesmo em caso de erro para não ficar tentando
        await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, "true");
      }
    }, REVIEW_DELAY_MS);
    
  } catch (error) {
    logger.error("Error in requestReviewAfterFirstMatch:", error);
    // Não propagar erro - falhar silenciosamente
  }
}

/**
 * Reseta o flag de review solicitado (útil para testes)
 * NÃO usar em produção
 */
export async function resetReviewFlag(): Promise<void> {
  try {
    await AsyncStorage.removeItem(REVIEW_REQUESTED_KEY);
    logger.log("Review flag reset");
  } catch (error) {
    logger.error("Error resetting review flag:", error);
  }
}
