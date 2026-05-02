import { dirname, join } from "node:path";

export const BOURSE_PORTFOLIO_URL =
  process.env.BOURSE_PORTFOLIO_URL ??
  "https://www.bourse-portefeuille-conseil.fr/wp-json/wp/v2/pages/1094";

export const BOURSE_STATE_PATH =
  process.env.BOURSE_STATE_PATH ?? join(process.cwd(), "data", "bourse-scout-state.json");

export const BOURSE_BRANDING = {
  title: "Bourse Scout",
  subjectPrefix: "Bourse Scout",
  footerSource: "Pierre Schchang — C'est Votre Argent",
};