// Minimal structural types for the Cloudflare bindings we use, so the Worker
// typechecks without depending on @cloudflare/workers-types.
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface AnalyticsEngineDataset {
  writeDataPoint(point: {
    blobs?: string[];
    doubles?: number[];
    indexes?: string[];
  }): void;
}

export type Bindings = {
  DB: D1Database;
  MEDIA?: unknown; // Optional: no route uses R2 yet.
  EVENTS?: AnalyticsEngineDataset;
  INGESTION_TOKEN?: string;
};
