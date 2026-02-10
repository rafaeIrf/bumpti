import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import { User } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

// Conditionally import Google Sign-In (only available on native)
let GoogleSignin: typeof import("@react-native-google-signin/google-signin").GoogleSignin;
let statusCodes: typeof import("@react-native-google-signin/google-signin").statusCodes;

// Dynamic import for native-only module
try {
  const googleSignIn = require("@react-native-google-signin/google-signin");
  GoogleSignin = googleSignIn.GoogleSignin;
  statusCodes = googleSignIn.statusCodes;
} catch {
  logger.warn("Google Sign-In not available (likely running on web)");
}

/**
 * Social authentication service using native SDKs + Supabase signInWithIdToken
 * 
 * This provides zero-friction authentication using hardware biometrics:
 * - Apple: FaceID/TouchID via expo-apple-authentication
 * - Google: One-Tap via @react-native-google-signin/google-signin
 */
class SocialAuthService {
  private isGoogleConfigured = false;

  /**
   * Configure Google Sign-In
   * Must be called before signInWithGoogle
   */
  configureGoogle() {
    if (!GoogleSignin) {
      logger.warn("Google Sign-In not available");
      return;
    }

    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

    if (!webClientId) {
      logger.error("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID not configured");
      return;
    }

    GoogleSignin.configure({
      webClientId,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      offlineAccess: false,
    });

    this.isGoogleConfigured = true;
    logger.log("Google Sign-In configured");
  }

  /**
   * Sign in with Google using native SDK
   * Returns authenticated Supabase user
   */
  async signInWithGoogle(): Promise<User> {
    if (!GoogleSignin) {
      throw new Error("Google Sign-In não disponível neste dispositivo");
    }

    if (!this.isGoogleConfigured) {
      this.configureGoogle();
    }

    try {
      // Check Google Play Services (Android)
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Trigger One-Tap UI
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        throw new Error("Não foi possível obter token do Google");
      }

      logger.log("Google Sign-In successful, syncing with Supabase...");

      // Exchange Google token for Supabase session
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });

      if (error) {
        logger.error("Supabase signInWithIdToken error:", error);
        throw error;
      }

      if (!data.user) {
        throw new Error("Falha na autenticação");
      }

      logger.log("Google Sign-In completed successfully");
      return data.user;
    } catch (error: any) {
      logger.error("Google Sign-In error:", error);

      // Handle specific Google Sign-In errors
      if (statusCodes) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
          throw new Error("Login cancelado");
        }
        if (error.code === statusCodes.IN_PROGRESS) {
          throw new Error("Login já em andamento");
        }
        if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          throw new Error("Google Play Services não disponível");
        }
      }

      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign in with Apple using native SDK (iOS only)
   * Returns authenticated Supabase user + Apple-provided full name (first auth only)
   */
  async signInWithApple(): Promise<{
    user: User;
    appleFullName?: { givenName?: string; familyName?: string };
  }> {
    if (Platform.OS !== "ios") {
      throw new Error("Login com Apple disponível apenas no iOS");
    }

    try {
      // Generate nonce for security
      const rawNonce = this.generateNonce();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      // Request Apple Sign-In
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      const identityToken = credential.identityToken;

      if (!identityToken) {
        throw new Error("Não foi possível obter token da Apple");
      }

      // Extract Apple-provided name (only available on FIRST authorization)
      const appleFullName = credential.fullName
        ? {
            givenName: credential.fullName.givenName ?? undefined,
            familyName: credential.fullName.familyName ?? undefined,
          }
        : undefined;

      if (appleFullName?.givenName) {
        logger.log("Apple provided user name:", appleFullName.givenName);
      } else {
        logger.log("Apple did not provide user name (subsequent login)");
      }

      logger.log("Apple Sign-In successful, syncing with Supabase...");

      // Exchange Apple token for Supabase session
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: identityToken,
        nonce: rawNonce,
      });

      if (error) {
        logger.error("Supabase signInWithIdToken error:", error);
        throw error;
      }

      if (!data.user) {
        throw new Error("Falha na autenticação");
      }

      logger.log("Apple Sign-In completed successfully");
      return { user: data.user, appleFullName };
    } catch (error: any) {
      logger.error("Apple Sign-In error:", error);

      // Handle Apple specific errors
      if (error.code === "ERR_REQUEST_CANCELED") {
        throw new Error("Login cancelado");
      }

      throw this.handleAuthError(error);
    }
  }

  /**
   * Check if Apple Sign-In is available on this device
   */
  async isAppleAuthAvailable(): Promise<boolean> {
    if (Platform.OS !== "ios") {
      return false;
    }

    try {
      return await AppleAuthentication.isAvailableAsync();
    } catch {
      return false;
    }
  }

  /**
   * Generate a random nonce for Apple Sign-In
   */
  private generateNonce(length = 32): string {
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const randomValues = new Uint8Array(length);
    
    // Use crypto.getRandomValues for secure random generation
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(randomValues);
    } else {
      // Fallback for environments without crypto
      for (let i = 0; i < length; i++) {
        randomValues[i] = Math.floor(Math.random() * 256);
      }
    }

    for (let i = 0; i < length; i++) {
      result += charset[randomValues[i] % charset.length];
    }

    return result;
  }

  /**
   * Handle auth errors and return user-friendly messages
   */
  private handleAuthError(error: Error): Error {
    let message = "Não foi possível fazer login. Tente novamente.";

    if (error.message) {
      // Keep specific error messages
      if (
        error.message.includes("cancelado") ||
        error.message.includes("andamento") ||
        error.message.includes("não disponível") ||
        error.message.includes("token")
      ) {
        return error;
      }
    }

    return new Error(message);
  }
}

// Export singleton instance
export const socialAuthService = new SocialAuthService();
