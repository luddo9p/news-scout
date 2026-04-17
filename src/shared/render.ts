import type {
  SynthesisData,
  StandardItem,
  TrendItem,
  Section,
} from "./synthesis-schema.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderStandardItem(item: StandardItem): string {
  const parts: string[] = [];

  // Link + title
  parts.push(
    `<a href="${escapeHtml(item.url)}" style="color:#007AFF;text-decoration:none;font-weight:500;">${escapeHtml(item.title)}</a>`,
  );

  // Context
  parts.push(
    `<span style="color:#3c3c43;"> — ${escapeHtml(item.context)}</span>`,
  );

  // Meta (author, source, score)
  const metaParts: string[] = [];
  if (item.author) metaParts.push(escapeHtml(item.author));
  metaParts.push(escapeHtml(item.source));
  if (item.score) metaParts.push(`${item.score} points`);
  if (metaParts.length > 0) {
    parts.push(
      ` <em style="color:#8e8e93;font-size:13px;">(${metaParts.join(", ")})</em>`,
    );
  }

  // Tags (plain text, dot separator)
  if (item.tags && item.tags.length > 0) {
    parts.push(
      `<span style="color:#8e8e93;font-size:13px;"> · ${item.tags.map((t) => escapeHtml(t)).join(" · ")}</span>`,
    );
  }

  let html = parts.join("");

  // Highlights (sub-list)
  if (item.highlights && item.highlights.length > 0) {
    const highlightItems = item.highlights
      .map(
        (h) =>
          `<li style="margin-bottom:4px;font-size:14px;color:#3c3c43;line-height:1.4;">${escapeHtml(h)}</li>`,
      )
      .join("");
    html += `<ul style="padding-left:20px;list-style:disc;margin:8px 0 0;">${highlightItems}</ul>`;
  }

  return `<li style="margin-bottom:16px;line-height:1.5;">${html}</li>`;
}

function renderTrendItem(item: TrendItem): string {
  const parts: string[] = [];

  parts.push(
    `<strong style="color:#1c1c1e;">${escapeHtml(item.title)}</strong>`,
  );
  parts.push(
    `<span style="color:#3c3c43;"> — ${escapeHtml(item.context)}</span>`,
  );

  // Citations
  if (item.citations.length > 0) {
    const citationHtml = item.citations
      .map(
        (c) =>
          `<div style="margin:6px 0 0 16px;font-size:14px;line-height:1.4;"><em style="color:#8e8e93;">(${escapeHtml(c.source)})</em> <a href="${escapeHtml(c.url)}" style="color:#007AFF;text-decoration:none;">${escapeHtml(c.text)}</a></div>`,
      )
      .join("");
    parts.push(citationHtml);
  }

  return `<li style="margin-bottom:16px;line-height:1.5;">${parts.join("")}</li>`;
}

function renderSection(section: Section): string {
  const sectionStyles =
    "font-size:20px;font-weight:700;color:#1c1c1e;margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid #e5e5ea;";
  let html = `<h2 style="${sectionStyles}">${escapeHtml(section.title)}</h2>`;

  if (section.items.length === 0) {
    html +=
      '<p style="color:#8e8e93;font-size:15px;margin:0 0 28px;">Rien de notable cette fois-ci</p>';
    return html;
  }

  const listStyle = "padding-left:0;list-style:none;margin:0 0 28px;";

  if (section.type === "standard") {
    const itemsHtml = section.items
      .map((item) => renderStandardItem(item as StandardItem))
      .join("");
    html += `<ul style="${listStyle}">${itemsHtml}</ul>`;
  } else {
    const itemsHtml = section.items
      .map((item) => renderTrendItem(item as TrendItem))
      .join("");
    html += `<ul style="${listStyle}">${itemsHtml}</ul>`;
  }

  return html;
}

export function renderSections(data: SynthesisData): string {
  return data.sections.map(renderSection).join("\n");
}