export interface PortfolioAsset {
  ticker: string;
  nom: string;
  dateAchat: string;
  coursAchat: number;
  dateVente: string;
  coursVente: number;
  plusMinusValue: string;
}

export interface PortfolioTable {
  year: number;
  label: string;
  isCurrent: boolean;
  performance: string;
  assets: PortfolioAsset[];
}

export interface PortfolioState {
  lastUpdated: string;
  suivi: PortfolioTable;
}

export type ChangeType = "new_purchase" | "new_sale" | "name_change";

export interface AssetChange {
  type: ChangeType;
  current: PortfolioAsset;
  previous?: PortfolioAsset;
}

export interface BourseScoutResult {
  success: boolean;
  emailSent: boolean;
  changes: number;
  errors: string[];
}