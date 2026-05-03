import { dirname, join } from "node:path";
import type { EmailBranding } from "../shared/types.js";

export interface BoursePortfolioConfig {
  name: string;
  apiUrl: string;
  statePath: string;
  branding: EmailBranding;
}

export const SCHANG_CONFIG: BoursePortfolioConfig = {
  name: "bourse-scout",
  apiUrl:
    process.env.BOURSE_PORTFOLIO_URL ??
    "https://www.bourse-portefeuille-conseil.fr/wp-json/wp/v2/pages/1094",
  statePath:
    process.env.BOURSE_STATE_PATH ??
    join(process.cwd(), "data", "bourse-scout-state.json"),
  branding: {
    title: "Bourse Scout",
    subjectPrefix: "Bourse Scout",
    footerSources: "Pierre Schchang — C'est Votre Argent",
  },
};

export const HIGGONS_CONFIG: BoursePortfolioConfig = {
  name: "higgons-scout",
  apiUrl:
    process.env.HIGGONS_PORTFOLIO_URL ??
    "https://www.bourse-portefeuille-conseil.fr/wp-json/wp/v2/pages/938",
  statePath:
    process.env.HIGGONS_STATE_PATH ??
    join(process.cwd(), "data", "higgons-scout-state.json"),
  branding: {
    title: "Higgons Scout",
    subjectPrefix: "Higgons Scout",
    footerSources: "William Higgons — C'est Votre Argent",
  },
};

export const MAUGEY_CONFIG: BoursePortfolioConfig = {
  name: "maugey-scout",
  apiUrl:
    process.env.MAUGEY_PORTFOLIO_URL ??
    "https://www.bourse-portefeuille-conseil.fr/wp-json/wp/v2/pages/1797",
  statePath:
    process.env.MAUGEY_STATE_PATH ??
    join(process.cwd(), "data", "maugey-scout-state.json"),
  branding: {
    title: "Maugey Scout",
    subjectPrefix: "Maugey Scout",
    footerSources: "Stéphanie Maugey — C'est Votre Argent",
  },
};

export const DUNAND_CONFIG: BoursePortfolioConfig = {
  name: "dunand-scout",
  apiUrl:
    process.env.DUNAND_PORTFOLIO_URL ??
    "https://www.bourse-portefeuille-conseil.fr/wp-json/wp/v2/pages/892",
  statePath:
    process.env.DUNAND_STATE_PATH ??
    join(process.cwd(), "data", "dunand-scout-state.json"),
  branding: {
    title: "Dunand Scout",
    subjectPrefix: "Dunand Scout",
    footerSources: "Léa Dunand-Chatellet — C'est Votre Argent",
  },
};