import { getCurrentLanguage } from "@/modules/locales";
import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import { AuthError, User } from "@supabase/supabase-js";

/**
 * Email authentication service using Supabase Auth
 */
class EmailAuthService {
  private verificationEmail: string | null = null;

  /**
   * Send OTP code to email
   * @param email - User's email address
   * @returns Promise when email OTP request is created
   */
  async sendEmailOTP(email: string): Promise<void> {
    try {
      // Get current app language (pt, en, or es)
      const currentLang = getCurrentLanguage().split("-")[0]; // Extract 'pt' from 'pt-BR'
      logger.log("Sending email OTP with language:", currentLang);
      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          shouldCreateUser: true,
          // Force OTP code instead of Magic Link
          emailRedirectTo: undefined,
          // Pass language to email template for i18n support
          data: {
            lang: currentLang, // Available as {{ .Data.lang }} in template
          },
        },
      });

      if (error) {
        throw error;
      }

      this.verificationEmail = email.toLowerCase().trim();
    } catch (error: any) {
      logger.error("Error sending email OTP:", error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Verify the OTP code entered by user
   * @param email - User's email address
   * @param token - 6-digit verification code
   * @returns Authenticated Supabase user
   */
  async verifyEmailOTP(email: string, token: string): Promise<User> {
    try {
      const normalizedEmail = email.toLowerCase().trim();

      // Check for Apple reviewer bypass (static OTP stored in database)
      // This keeps the "master password" secure in the database, not in app source code
      const { data: isReviewer, error: rpcError } = await supabase.rpc(
        "check_reviewer_otp",
        {
          p_email: normalizedEmail,
          p_token: token,
        }
      );

      if (rpcError) {
        logger.warn("Reviewer check RPC failed, continuing with normal flow:", rpcError.message);
      }

      if (isReviewer === true) {
        logger.log("🍎 Apple reviewer bypass activated");

        // Reviewer uses password-based login instead of OTP
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password: "$Rev1ewer#2026!", // Set in Supabase Dashboard
          });

        if (signInError || !signInData.user) {
          logger.error("Reviewer login failed:", signInError?.message);
          throw signInError || new Error("Reviewer login failed");
        }

        this.verificationEmail = null;
        return signInData.user;
      }

      // Normal flow: verify OTP with Supabase Auth
      const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token,
        type: "email",
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("Falha na autenticação");
      }

      this.verificationEmail = null;
      return data.user;
    } catch (error: any) {
      logger.error("Error verifying email OTP:", error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Resend OTP code to the same email
   * @param email - User's email address
   */
  async resendEmailOTP(email: string): Promise<void> {
    return this.sendEmailOTP(email);
  }

  /**
   * Get the email currently being verified
   */
  getVerificationEmail(): string | null {
    return this.verificationEmail;
  }

  /**
   * Clear verification state (on logout or error)
   */
  clearVerificationState(): void {
    this.verificationEmail = null;
  }

  /**
   * Handle authentication errors with user-friendly messages
   */
  private handleAuthError(error: AuthError | Error): Error {
    if ("status" in error) {
      const authError = error as AuthError;

      switch (authError.status) {
        case 400:
          if (authError.message.includes("invalid")) {
            return new Error("E-mail inválido");
          }
          return new Error("Código inválido ou expirado");

        case 429:
          return new Error("Muitas tentativas. Aguarde alguns minutos");

        case 500:
          return new Error("Erro no servidor. Tente novamente");

        default:
          return new Error(
            authError.message || "Erro ao autenticar. Tente novamente"
          );
      }
    }

    return new Error("Não foi possível fazer login. Tente novamente.");
  }
}

export const emailAuthService = new EmailAuthService();
