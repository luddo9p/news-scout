import type { AssetChange, PortfolioTable } from "./types.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const COLORS = {
  purchase: "#34C759",
  sale: "#FF3B30",
  nameChange: "#FF9500",
} as const;

export function makeBourseSubject(
  date: Date,
  changeCount: number,
  subjectPrefix: string,
): string {
  const formatted = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `${subjectPrefix} — ${changeCount} changement(s) détecté(s) (${formatted})`;
}

export function makeBourseInitSubject(subjectPrefix: string): string {
  return `${subjectPrefix} — Mise en service`;
}

export function buildBourseChangeEmailHtml(
  changes: AssetChange[],
  currentTable: PortfolioTable,
  date: Date,
  title: string,
  footerSource: string,
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

  const openCount = currentTable.assets.filter((a) => a.dateVente === "").length;
  const closedCount = currentTable.assets.length - openCount;
  const summary = `Portefeuille Suivi ${currentTable.year} : ${currentTable.assets.length} positions (${openCount} ouvertes, ${closedCount} clôturées) — Perf : ${currentTable.performance}`;

  const purchases = changes.filter((c) => c.type === "new_purchase");
  const sales = changes.filter((c) => c.type === "new_sale");
  const nameChanges = changes.filter((c) => c.type === "name_change");

  let content = `<p style="margin:0 0 8px;font-size:15px;color:#8e8e93;">${escapeHtml(summary)}</p>`;

  if (purchases.length > 0) {
    content += buildSection("Nouveaux achats", COLORS.purchase, [
      "Ticker",
      "Nom",
      "Date Achat",
      "Cours Achat",
    ]);
    for (const c of purchases) {
      content += buildRow([
        c.current.ticker,
        c.current.nom,
        c.current.dateAchat,
        formatPrice(c.current.coursAchat),
      ]);
    }
    content += `</table></td></tr></table></td></tr></table>`;
  }

  if (sales.length > 0) {
    content += buildSection("Ventes", COLORS.sale, [
      "Ticker",
      "Nom",
      "Date Achat",
      "Date Vente",
      "+/- Value",
    ]);
    for (const c of sales) {
      content += buildRow([
        c.current.ticker,
        c.current.nom,
        c.current.dateAchat,
        c.current.dateVente,
        c.current.plusMinusValue,
      ]);
    }
    content += `</table></td></tr></table></td></tr></table>`;
  }

  if (nameChanges.length > 0) {
    content += buildSection("Changements de nom", COLORS.nameChange, [
      "Ticker",
      "Ancien nom",
      "Nouveau nom",
    ]);
    for (const c of nameChanges) {
      content += buildRow([
        c.current.ticker,
        c.previous?.nom ?? "—",
        c.current.nom,
      ]);
    }
    content += `</table></td></tr></table></td></tr></table>`;
  }

  return wrapInTemplate(content, title, formattedDate, footerSource);
}

export function buildBourseInitEmailHtml(
  currentTable: PortfolioTable,
  date: Date,
  title: string,
  footerSource: string,
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

  const openCount = currentTable.assets.filter((a) => a.dateVente === "").length;
  const closedCount = currentTable.assets.length - openCount;
  const summary = `Portefeuille Suivi ${currentTable.year} : ${currentTable.assets.length} positions (${openCount} ouvertes, ${closedCount} clôturées) — Perf : ${currentTable.performance}`;

  let content = `
    <p style="margin:0 0 16px;font-size:17px;font-weight:600;color:#1c1c1e;">Mise en service</p>
    <p style="margin:0 0 16px;font-size:15px;color:#1c1c1e;">${escapeHtml(summary)}</p>
    <p style="margin:0 0 8px;font-size:13px;color:#8e8e93;">Les prochains emails ne seront envoyés qu'en cas de changement détecté.</p>
  `;

  content += buildSection("Positions actuelles", "#007AFF", [
    "Ticker",
    "Nom",
    "Date Achat",
    "Cours Achat",
    "Date Vente",
    "+/- Value",
  ]);
  for (const a of currentTable.assets) {
    content += buildRow([
      a.ticker,
      a.nom,
      a.dateAchat,
      formatPrice(a.coursAchat),
      a.dateVente || "—",
      a.plusMinusValue,
    ]);
  }
  content += `</table></td></tr></table></td></tr></table>`;

  return wrapInTemplate(content, title, formattedDate, footerSource);
}

function buildSection(
  title: string,
  color: string,
  headers: string[],
): string {
  const headerCells = headers
    .map(
      (h) =>
        `<th style="padding:8px 12px;font-size:12px;font-weight:600;color:#8e8e93;text-align:left;border-bottom:1px solid #e5e5ea;">${h}</th>`,
    )
    .join("");

  return `
    <p style="margin:20px 0 8px;font-size:15px;font-weight:600;color:${color};">${escapeHtml(title)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5ea;">
      <tr><td style="padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>${headerCells}</tr>
  `;
}

function buildRow(cells: string[]): string {
  const tds = cells
    .map(
      (c) =>
        `<td style="padding:6px 12px;font-size:14px;color:#1c1c1e;border-bottom:1px solid #f2f2f7;">${escapeHtml(c)}</td>`,
    )
    .join("");
  return `<tr>${tds}</tr>`;
}

function formatPrice(price: number): string {
  return price.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function wrapInTemplate(
  content: string,
  title: string,
  formattedDate: string,
  footerSource: string,
): string {
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
                ${escapeHtml(title)}
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
          Généré automatiquement par ${escapeHtml(title)}<br>
          Source : ${escapeHtml(footerSource)}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}