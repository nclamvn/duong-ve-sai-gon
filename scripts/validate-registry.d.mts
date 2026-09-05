export interface RegistryStats {
  P: number;
  S: number;
  H: number;
  X: number;
  total: number;
}
export interface RegistryReport {
  errors: string[];
  stats: Record<string, RegistryStats>;
  facts: number;
  files: number;
}
export function validateRegistries(dir?: string, manifestPath?: string): RegistryReport;
