import { Resend } from "resend";

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

const EMAIL_SUBJECT = (date: Date): string => {
  const formatted = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `Agent Scout — Veille du ${formatted}`;
};

export function buildEmailHtml(content: string, date: Date): string {
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
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:20px;">
    <tr>
      <td style="background-color:#1a1a2e;border-radius:12px 12px 0 0;padding:24px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">
          &#128270; Agent Scout
        </h1>
        <p style="margin:8px 0 0;color:#a0a0b8;font-size:14px;">
          Veille IA &amp; Vibe Coding &mdash; ${formattedDate}
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color:#ffffff;padding:24px;border-radius:0 0 12px 12px;">
        ${content}
      </td>
    </tr>
    <tr>
      <td style="text-align:center;padding:20px;color:#888888;font-size:12px;">
        <p style="margin:0;">Généré automatiquement par Agent Scout</p>
        <p style="margin:4px 0 0;">Sources : Bluesky &bull; Hacker News &bull; X/Twitter</p>
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

export { EMAIL_SUBJECT };
