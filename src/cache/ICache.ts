export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  lastAccessedAt: number;
  hitCount: number;
  tags: string[];
}

export interface CacheOptions {
  defaultTTL?: number;
  maxEntries?: number;
  enabled?: boolean;
}

export interface ICache {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttl?: number, tags?: string[]): void;
  has(key: string): boolean;
  delete(key: string): boolean;
  deleteByTag(tag: string): number;
  deleteByPattern(pattern: RegExp | string): number;
  clear(): void;
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  onInvalidate?(callback: (key: string, value: unknown) => void): void;
  invalidateByProductId?(productId: string): number;
  invalidateAllSearch?(): number;
  invalidateAllResources?(): number;
}
