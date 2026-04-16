import { Resend } from "resend";
import type { EmailBranding } from "./types.js";

interface SendEmailParams {
  htmlContent: string;
  subject: string;
  from: string;
  to: string;
  apiKey: string;
}

interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export function makeEmailSubject(date: Date, branding: EmailBranding): string {
  const formatted = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `${branding.subjectPrefix} — Veille du ${formatted}`;
}

export function buildEmailHtml(
  content: string,
  date: Date,
  branding: EmailBranding,
): string {
  const formattedDate = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f2f2f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,sans-serif;color:#1c1c1e;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;">
    <tr>
      <td style="padding:40px 0 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 24px;">
              <h1 style="margin:0;font-size:28px;font-weight:700;letter-spacing:-0.5px;color:#1c1c1e;">
                ${branding.title}
              </h1>
              <p style="margin:6px 0 0;font-size:15px;font-weight:400;color:#8e8e93;">
                ${formattedDate}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 24px;">
              ${content}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 24px 40px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#8e8e93;line-height:1.5;">
          Généré automatiquement par ${branding.title}<br>
          Sources : ${branding.footerSources}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendEmail(
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const { htmlContent, subject, from, to, apiKey } = params;

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html: htmlContent,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}