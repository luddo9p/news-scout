import type { PortfolioAsset, PortfolioTable, AssetChange, ChangeType } from "./types.js";

export function assetKey(asset: PortfolioAsset): string {
  return `${asset.ticker}::${asset.dateAchat}`;
}

export function computeDiff(
  previous: PortfolioTable | undefined,
  current: PortfolioTable,
): AssetChange[] {
  if (!previous) return [];
  if (previous.year !== current.year) return [];

  const previousMap = new Map<string, PortfolioAsset>();
  for (const asset of previous.assets) {
    previousMap.set(assetKey(asset), asset);
  }

  const changes: AssetChange[] = [];

  for (const currentAsset of current.assets) {
    const key = assetKey(currentAsset);
    const previousAsset = previousMap.get(key);

    if (!previousAsset) {
      changes.push({ type: "new_purchase", current: currentAsset });
    } else {
      if (previousAsset.dateVente === "" && currentAsset.dateVente !== "") {
        changes.push({ type: "new_sale", current: currentAsset, previous: previousAsset });
      }
      if (previousAsset.nom !== currentAsset.nom) {
        changes.push({ type: "name_change", current: currentAsset, previous: previousAsset });
      }
    }
  }

  return changes;
}