import {
  FirebaseAuthTypes,
  getAuth,
  signInWithPhoneNumber,
  signOut,
} from "@react-native-firebase/auth";

/**
 * Phone authentication service using Firebase Auth
 */
class PhoneAuthService {
  private confirmation: FirebaseAuthTypes.ConfirmationResult | null = null;

  /**
   * Send verification code to phone number
   * @param phoneNumber - Full phone number with country code (e.g., +5511999999999)
   * @returns Promise with confirmation result
   */
  async sendVerificationCode(
    phoneNumber: string
  ): Promise<FirebaseAuthTypes.ConfirmationResult> {
    try {
      const auth = getAuth();

      // Sign out current user if any
      if (auth.currentUser) {
        await signOut(auth);
      }

      // Send verification code
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber);
      this.confirmation = confirmation;

      return confirmation;
    } catch (error: any) {
      console.error("Error sending verification code:", error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Verify the code entered by user
   * @param code - 6-digit verification code
   * @returns Promise with user credential
   */
  async verifyCode(code: string): Promise<FirebaseAuthTypes.UserCredential> {
    try {
      if (!this.confirmation) {
        throw new Error("No verification in progress");
      }

      const userCredential = await this.confirmation.confirm(code);

      if (!userCredential) {
        throw new Error("Verification failed");
      }

      this.confirmation = null;

      return userCredential;
    } catch (error: any) {
      console.error("Error verifying code:", error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Resend verification code to the same phone number
   * @param phoneNumber - Full phone number with country code
   * @returns Promise with new confirmation result
   */
  async resendVerificationCode(
    phoneNumber: string
  ): Promise<FirebaseAuthTypes.ConfirmationResult> {
    return this.sendVerificationCode(phoneNumber);
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    try {
      const auth = getAuth();
      await signOut(auth);
      this.confirmation = null;
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): FirebaseAuthTypes.User | null {
    const auth = getAuth();
    return auth.currentUser;
  }

  /**
   * Handle Firebase Auth errors and return user-friendly messages
   */
  private handleAuthError(error: any): Error {
    const errorCode = error.code;
    let message = "Ocorreu um erro. Tente novamente.";

    switch (errorCode) {
      case "auth/invalid-phone-number":
        message = "Número de telefone inválido.";
        break;
      case "auth/missing-phone-number":
        message = "Por favor, insira um número de telefone.";
        break;
      case "auth/quota-exceeded":
        message = "Muitas tentativas. Tente novamente mais tarde.";
        break;
      case "auth/invalid-verification-code":
        message = "Código de verificação inválido.";
        break;
      case "auth/session-expired":
        message = "Código expirado. Solicite um novo código.";
        break;
      case "auth/too-many-requests":
        message = "Muitas tentativas. Aguarde alguns minutos.";
        break;
      case "auth/network-request-failed":
        message = "Erro de conexão. Verifique sua internet.";
        break;
      default:
        message = error.message || message;
    }

    return new Error(message);
  }
}

// Export singleton instance
export const phoneAuthService = new PhoneAuthService();
