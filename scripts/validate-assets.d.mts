export interface AssetReport {
  errors: string[];
  warnings: string[];
  assets: number;
  totalMB: number;
}
export function validateAssets(opts?: { strictTris?: boolean }): AssetReport;
