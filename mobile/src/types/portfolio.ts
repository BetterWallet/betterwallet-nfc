export interface PortfolioAsset {
  symbol: string;
  name: string;
  amount: number;
  priceUsd: number;
  valueUsd: number;
  imageUrl: string;
}

export interface PortfolioSnapshot {
  assets: PortfolioAsset[];
  totalUsd: number;
  updatedAt: string;
}
