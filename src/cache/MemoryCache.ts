import { ICache, CacheEntry, CacheOptions } from './ICache';

export class MemoryCache implements ICache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private options: Required<CacheOptions>;
  private hits = 0;
  private misses = 0;
  private invalidateCallback?: (key: string, value: unknown) => void;

  constructor(options: CacheOptions = {}) {
    this.options = {
      defaultTTL: options.defaultTTL ?? 5 * 60 * 1000,
      maxEntries: options.maxEntries ?? 1000,
      enabled: options.enabled ?? true
    };
  }

  private generateCacheKey(method: string, url: string, params?: Record<string, unknown>): string {
    const paramsStr = params ? JSON.stringify(this.sortObject(params)) : '';
    return `${method}:${url}:${paramsStr}`;
  }

  private sortObject(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.keys(obj)
      .sort()
      .reduce((result, key) => {
        const value = obj[key];
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          result[key] = this.sortObject(value as Record<string, unknown>);
        } else {
          result[key] = value;
        }
        return result;
      }, {} as Record<string, unknown>);
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() > entry.expiresAt;
  }

  private evictIfNeeded(): void {
    if (this.cache.size >= this.options.maxEntries) {
      const entries = Array.from(this.cache.entries()).sort((a, b) =>
        a[1].lastAccessedAt - b[1].lastAccessedAt
      );
      const toDelete = entries.slice(0, Math.floor(this.options.maxEntries * 0.1));
      for (const [key] of toDelete) {
        this.cache.delete(key);
      }
    }
  }

  get<T>(key: string): T | undefined {
    if (!this.options.enabled) {
      this.misses++;
      return undefined;
    }

    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.misses++;
      this.invalidateCallback?.(key, entry.value);
      return undefined;
    }

    this.hits++;
    entry.lastAccessedAt = Date.now();
    entry.hitCount++;

    return entry.value;
  }

  set<T>(key: string, value: T, ttl?: number, tags: string[] = []): void {
    if (!this.options.enabled) return;

    this.evictIfNeeded();

    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: now,
      expiresAt: now + (ttl ?? this.options.defaultTTL),
      lastAccessedAt: now,
      hitCount: 0,
      tags
    };

    this.cache.set(key, entry as CacheEntry<unknown>);
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.invalidateCallback?.(key, entry.value);
    }
    return this.cache.delete(key);
  }

  deleteByTag(tag: string): number {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      const entry = this.cache.get(key);
      if (entry) {
        this.invalidateCallback?.(key, entry.value);
      }
      this.cache.delete(key);
    }

    return keysToDelete.length;
  }

  deleteByPattern(pattern: RegExp | string): number {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    const keysToDelete: string[] = [];

    for (const [key] of this.cache.entries()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      const entry = this.cache.get(key);
      if (entry) {
        this.invalidateCallback?.(key, entry.value);
      }
      this.cache.delete(key);
    }

    return keysToDelete.length;
  }

  clear(): void {
    if (this.invalidateCallback) {
      for (const [key, entry] of this.cache.entries()) {
        this.invalidateCallback(key, entry.value);
      }
    }
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0
    };
  }

  isEnabled(): boolean {
    return this.options.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.options.enabled = enabled;
  }

  onInvalidate(callback: (key: string, value: unknown) => void): void {
    this.invalidateCallback = callback;
  }

  setDefaultTTL(ttl: number): void {
    this.options.defaultTTL = ttl;
  }

  setMaxEntries(max: number): void {
    this.options.maxEntries = max;
  }

  getAllKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  invalidateByProductId(productId: string): number {
    return this.deleteByTag(`product:${productId}`);
  }

  invalidateAllSearch(): number {
    return this.deleteByPattern(/^GET:.*\/catalog\/search/);
  }

  invalidateAllResources(): number {
    return this.deleteByPattern(/^GET:.*\/resources\//);
  }
}
