import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET") as string;

// Templates por idioma
const templates = {
  pt: {
    subject: (token: string) => `${token} é o seu código de acesso para o Bumpti`,
    html: (token: string) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #0A0A0A; color: #E8ECEF; padding: 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #1A1A1A; border-radius: 16px; padding: 40px; text-align: center;">
          <h1 style="color: #1D9BF0; font-size: 28px; margin-bottom: 10px;">Bumpti</h1>
          <p style="color: #8B98A5; font-size: 16px; line-height: 1.6; margin: 16px 0;">Seu código de verificação:</p>
          <div style="background: linear-gradient(135deg, #1D9BF0 0%, #1A8CD8 100%); color: white; font-size: 36px; font-weight: bold; letter-spacing: 6px; padding: 20px; border-radius: 12px; margin: 24px 0; font-family: monospace;">
            ${token}
          </div>
          <p style="color: #5B6671; font-size: 14px; margin-top: 24px;">Este código expira em 60 minutos.</p>
          <p style="font-size: 14px; margin-top: 32px; color: #8B98A5;">
            Se você não solicitou este código, ignore este email.
          </p>
        </div>
      </body>
      </html>
    `,
  },
  en: {
    subject: (token: string) => `${token} is your Bumpti access code`,
    html: (token: string) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #0A0A0A; color: #E8ECEF; padding: 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #1A1A1A; border-radius: 16px; padding: 40px; text-align: center;">
          <h1 style="color: #1D9BF0; font-size: 28px; margin-bottom: 10px;">Bumpti</h1>
          <p style="color: #8B98A5; font-size: 16px; line-height: 1.6; margin: 16px 0;">Your verification code:</p>
          <div style="background: linear-gradient(135deg, #1D9BF0 0%, #1A8CD8 100%); color: white; font-size: 36px; font-weight: bold; letter-spacing: 6px; padding: 20px; border-radius: 12px; margin: 24px 0; font-family: monospace;">
            ${token}
          </div>
          <p style="color: #5B6671; font-size: 14px; margin-top: 24px;">This code expires in 60 minutes.</p>
          <p style="font-size: 14px; margin-top: 32px; color: #8B98A5;">
            If you didn't request this code, ignore this email.
          </p>
        </div>
      </body>
      </html>
    `,
  },
  es: {
    subject: (token: string) => `${token} es tu código de acceso para Bumpti`,
    html: (token: string) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #0A0A0A; color: #E8ECEF; padding: 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #1A1A1A; border-radius: 16px; padding: 40px; text-align: center;">
          <h1 style="color: #1D9BF0; font-size: 28px; margin-bottom: 10px;">Bumpti</h1>
          <p style="color: #8B98A5; font-size: 16px; line-height: 1.6; margin: 16px 0;">Tu código de verificación:</p>
          <div style="background: linear-gradient(135deg, #1D9BF0 0%, #1A8CD8 100%); color: white; font-size: 36px; font-weight: bold; letter-spacing: 6px; padding: 20px; border-radius: 12px; margin: 24px 0; font-family: monospace;">
            ${token}
          </div>
          <p style="color: #5B6671; font-size: 14px; margin-top: 24px;">Este código expira en 60 minutos.</p>
          <p style="font-size: 14px; margin-top: 32px; color: #8B98A5;">
            Si no solicitaste este código, ignora este correo.
          </p>
        </div>
      </body>
      </html>
    `,
  },
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("not allowed", { status: 400 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);

  try {
    const { user, email_data } = wh.verify(payload, headers) as {
      user: {
        email: string;
        user_metadata: {
          lang?: string;
        };
      };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
        site_url: string;
        token_new: string;
        token_hash_new: string;
      };
    };

    // Detectar idioma preferido (fallback para PT)
    const lang = (user.user_metadata?.lang || "pt") as
      | "pt"
      | "en"
      | "es";
    const template = templates[lang] || templates.pt;

    console.log(
      `Sending ${email_data.email_action_type} email to ${user.email} in ${lang}`
    );

    // Enviar email via Resend
    const { error } = await resend.emails.send({
      from: "Bumpti <noreply@resend.dev>", // TODO: Change to verified domain
      to: [user.email],
      subject: template.subject(email_data.token),
      html: template.html(email_data.token),
    });

    if (error) {
      throw error;
    }

    console.log(`✅ Email sent successfully to ${user.email} in ${lang}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Error in send-email hook:", error);
    return new Response(
      JSON.stringify({
        error: {
          http_code: error.code || 500,
          message: error.message,
        },
      }),
      {
        status: error.code === 401 ? 401 : 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
