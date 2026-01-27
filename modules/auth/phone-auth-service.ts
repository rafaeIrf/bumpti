import { deactivateDeviceToken } from "@/modules/notifications";
import { supabase } from "@/modules/supabase/client";
import { clearPrefetchCache } from "@/utils/image-prefetch";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthError, User } from "@supabase/supabase-js";
import { resetDatabase } from "../database";
import { resetGlobalStore } from "../store";

/**
 * Phone authentication service using Supabase Auth
 */
class PhoneAuthService {
  private verificationPhone: string | null = null;

  /**
   * Send verification code to phone number
   * @param phoneNumber - Full phone number with country code (e.g., +5511999999999)
   * @returns Promise when SMS request is created
   */
  async sendVerificationCode(phoneNumber: string): Promise<void> {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneNumber,
        options: {
          channel: "sms",
          shouldCreateUser: true,
        },
      });

      if (error) {
        throw error;
      }

      this.verificationPhone = phoneNumber;
    } catch (error: any) {
      console.error("Error sending verification code:", error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Verify the code entered by user
   * @param code - 6-digit verification code
   * @returns Authenticated Supabase user
   */
  async verifyCode(code: string): Promise<User> {
    try {
      if (!this.verificationPhone) {
        throw new Error("No verification in progress");
      }

      const { data, error } = await supabase.auth.verifyOtp({
        phone: this.verificationPhone,
        token: code,
        type: "sms",
      });

      if (error) {
        throw error;
      }

      if (!data?.user) {
        throw new Error("Verification failed");
      }

      this.verificationPhone = null;

      return data.user;
    } catch (error: any) {
      console.error("Error verifying code:", error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Resend verification code to the same phone number
   * @param phoneNumber - Full phone number with country code
   * @returns Promise when SMS request is recreated
   */
  async resendVerificationCode(phoneNumber: string): Promise<void> {
    return this.sendVerificationCode(phoneNumber);
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    try {
      // Deactivate FCM token before signing out (don't let this block logout)
      try {
        await deactivateDeviceToken();
      } catch (fcmError) {
        console.error("FCM deactivation failed (non-blocking):", fcmError);
      }
      
      await supabase.auth.signOut();
      
      // Clear all AsyncStorage data (onboarding, banner dismissals, etc.)
      await AsyncStorage.clear();
      
      // Clear local database
      await resetDatabase();
      
      // Clear Redux store
      await resetGlobalStore();

      clearPrefetchCache();
      
      this.verificationPhone = null;
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }

  /**
   * Delete current user account
   */
  async deleteAccount(): Promise<void> {
    try {
      const { error } = await supabase.functions.invoke("delete-account");

      if (error) {
        throw error;
      }

      // signOut already calls resetGlobalStore, no need to call it again
      await this.signOut();
    } catch (error) {
      console.error("Error deleting account:", error);
      throw error;
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.error("Error getting current user:", error);
      return null;
    }

    return data.user;
  }

  /**
   * Handle Firebase Auth errors and return user-friendly messages
   */
  private handleAuthError(error: AuthError | Error): Error {
    let message = "Ocorreu um erro. Tente novamente.";

    if (error instanceof AuthError) {
      if (error.status === 400) {
        message = "Dados inválidos. Verifique o telefone ou código enviado.";
      } else if (error.status === 401) {
        message = "Código de verificação inválido ou expirado.";
      } else if (error.status === 429) {
        message = "Muitas tentativas. Aguarde um momento antes de tentar novamente.";
      } else if (error.status >= 500) {
        message = "Serviço temporariamente indisponível. Tente novamente em instantes.";
      } else if (error.message) {
        message = error.message;
      }
    } else if (error.message) {
      message = error.message;
    }

    return new Error(message);
  }
}

// Export singleton instance
export const phoneAuthService = new PhoneAuthService();
