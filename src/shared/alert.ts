import { sendEmail } from "./send-email.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Warns by email that a run failed.
 *
 * A failing agent used to leave nothing behind but a log file nobody reads, which is
 * how two weeks of silence went unnoticed. Best effort by design: this must never mask
 * the run's real outcome, so it never throws and stays silent when Resend is not
 * configured (in which case it could not send anything anyway).
 */
export async function sendFailureAlert(
  agentName: string,
  errors: string[],
  date: Date = new Date(),
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.RESEND_TO;
  const from = process.env.RESEND_FROM || "onboarding@resend.dev";
  if (!apiKey || !to) return;

  const stamp = date.toLocaleString("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });
  const details = errors.length > 0 ? errors : ["Aucun detail fourni par le run."];
  const items = details
    .map(
      (error) =>
        `<li style="margin-bottom:8px;font-size:14px;color:#1c1c1e;line-height:1.5;">${escapeHtml(error)}</li>`,
    )
    .join("");

  const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f2f2f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,sans-serif;color:#1c1c1e;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;">
    <tr>
      <td style="padding:40px 16px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 24px;">
              <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#FF3B30;">
                Run en echec : ${escapeHtml(agentName)}
              </h1>
              <p style="margin:0 0 20px;font-size:14px;color:#8e8e93;">
                ${escapeHtml(stamp)}
              </p>
              <ul style="padding-left:20px;list-style:disc;margin:0;">
                ${items}
              </ul>
              <p style="margin:24px 0 0;font-size:13px;color:#8e8e93;line-height:1.5;">
                Aucun email de veille n'a ete envoye pour ce run. Le detail complet se trouve
                dans /var/log/agent-scout sur le VPS.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const result = await sendEmail({
    htmlContent,
    subject: `Agent Scout — échec du run ${agentName}`,
    from,
    to,
    apiKey,
  });

  console.log(
    `[alert] ${result.success ? `failure email sent (${result.id})` : `failure email failed: ${result.error}`}`,
  );
}
