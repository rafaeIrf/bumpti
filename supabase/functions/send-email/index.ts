import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET")!.replace("v1,", "");

// Content por idioma
const content = {
  pt: {
    subject: (token: string) => `${token} é o seu código de acesso para o Bumpti`,
    title: "Seu código de acesso",
    greeting: 'Olá! Use o código abaixo para entrar no <span style="color: #1D9BF0; font-weight: 600;">Bumpti</span> e descobrir quem está ao seu redor agora.',
    expiry: "Este código expira em 10 minutos.",
    footer: "Conectando pessoas em locais reais.",
  },
  en: {
    subject: (token: string) => `${token} is your Bumpti access code`,
    title: "Your access code",
    greeting: 'Hello! Use the code below to enter <span style="color: #1D9BF0; font-weight: 600;">Bumpti</span> and discover who is around you right now.',
    expiry: "This code expires in 10 minutes.",
    footer: "Connecting people in real places.",
  },
  es: {
    subject: (token: string) => `${token} es tu código de acceso para Bumpti`,
    title: "Tu código de acceso",
    greeting: '¡Hola! Usa el siguiente código para entrar en <span style="color: #1D9BF0; font-weight: 600;">Bumpti</span> y descubrir quién está a tu alrededor ahora.',
    expiry: "Este código caduca en 10 minutos.",
    footer: "Conectando personas en lugares reales.",
  },
};

const buildHtml = (token: string, lang: "pt" | "en" | "es") => {
  const t = content[lang] || content.pt;
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <title>Bumpti Auth</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 0;">
  <center>
    <div style="max-width: 480px; margin: 40px auto; background: #ffffff; padding: 40px; border-radius: 20px; text-align: center; border: 1px solid #eeeeee;">
      
      <!-- LOGO -->
      <div style="font-family: 'Poppins', sans-serif; font-size: 32px; font-weight: 800; color: #1D9BF0; margin-bottom: 30px; letter-spacing: -1.5px;">
        bumpti
      </div>

      <!-- TÍTULO -->
      <h2 style="font-family: 'Poppins', sans-serif; font-size: 22px; font-weight: 700; color: #1a1a1a; margin-bottom: 15px; margin-top: 0;">
        ${t.title}
      </h2>

      <!-- TEXTO -->
      <p style="font-family: 'Poppins', sans-serif; font-size: 16px; line-height: 24px; color: #555555; margin-bottom: 30px;">
        ${t.greeting}
      </p>

      <!-- CONTAINER DO CÓDIGO -->
      <div style="background-color: #E8F5FE; border: 2px solid #1D9BF0; border-radius: 14px; padding: 25px; margin-bottom: 30px;">
        <span style="font-family: 'SF Mono', 'Roboto Mono', Menlo, monospace; font-size: 38px; font-weight: 800; color: #1D9BF0; letter-spacing: 10px;">
          ${token}
        </span>
      </div>

      <!-- AVISO DE EXPIRAÇÃO -->
      <p style="font-family: 'Poppins', sans-serif; font-size: 14px; color: #888888; margin-bottom: 0;">
        ${t.expiry}
      </p>

      <!-- RODAPÉ -->
      <div style="margin-top: 35px; padding-top: 20px; border-top: 1px solid #f0f0f0; font-family: 'Poppins', sans-serif; font-size: 12px; color: #aaaaaa; line-height: 18px;">
        <strong>Bumpti</strong><br>
        ${t.footer}
        <br>&copy; 2026
      </div>
    </div>
  </center>
</body>
</html>`;
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

    // Bypass: Skip email for Apple reviewers (they use static code 000000)
    const reviewerEmails = ["reviewer@bumpti.com", "reviewer_onboarding@bumpti.com"];
    if (reviewerEmails.includes(user.email.toLowerCase())) {
      console.log(`🍎 Apple reviewer bypass - Token would be: ${email_data.token}`);
      return new Response(JSON.stringify({ success: true, bypass: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Detectar idioma preferido (fallback para PT)
    const lang = (user.user_metadata?.lang || "pt") as "pt" | "en" | "es";
    const langContent = content[lang] || content.pt;

    console.log(
      `Sending ${email_data.email_action_type} email to ${user.email} in ${lang}`
    );

    // Enviar email via Resend
    const { error } = await resend.emails.send({
      from: "Bumpti <noreply@bumpti.com>",
      to: [user.email],
      subject: langContent.subject(email_data.token),
      html: buildHtml(email_data.token, lang),
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
