import { SheetRow, ExpandedRow } from '../types';

interface ChunkStore<T> {
  chunks: T[][];
  totalCount: number;
  chunkSize: number;
}

class MemoryChunkCacheManager {
  private cache: Map<string, ChunkStore<any>> = new Map();
  private chunkSize = 50000; // 50k rows per chunk

  constructor() {
    // Auto-cleanup on window unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.clearAll();
      });
    }
  }

  public setRows<T>(key: string, rows: T[]): void {
    if (!rows || rows.length === 0) {
      this.cache.delete(key);
      return;
    }

    const chunks: T[][] = [];
    for (let i = 0; i < rows.length; i += this.chunkSize) {
      chunks.push(rows.slice(i, i + this.chunkSize));
    }

    this.cache.set(key, {
      chunks,
      totalCount: rows.length,
      chunkSize: this.chunkSize,
    });
  }

  public getRows<T>(key: string): T[] {
    const store = this.cache.get(key);
    if (!store || !store.chunks || store.chunks.length === 0) {
      return [];
    }
    const result: T[] = [];
    for (const chunk of store.chunks) {
      result.push(...chunk);
    }
    return result;
  }

  public getRowAt<T>(key: string, index: number): T | undefined {
    const store = this.cache.get(key);
    if (!store || index < 0 || index >= store.totalCount) return undefined;
    const chunkIdx = Math.floor(index / store.chunkSize);
    const itemIdx = index % store.chunkSize;
    return store.chunks[chunkIdx]?.[itemIdx];
  }

  public getCount(key: string): number {
    const store = this.cache.get(key);
    return store ? store.totalCount : 0;
  }

  public slice<T>(key: string, start: number, end: number): T[] {
    const store = this.cache.get(key);
    if (!store || store.totalCount === 0) return [];
    
    const result: T[] = [];
    const actualEnd = Math.min(end, store.totalCount);
    for (let i = Math.max(0, start); i < actualEnd; i++) {
      const item = this.getRowAt<T>(key, i);
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  public getPreview<T>(key: string, limit = 50): T[] {
    return this.slice<T>(key, 0, limit);
  }

  public filterRows<T>(key: string, predicate: (item: T) => boolean, maxResults = 200): T[] {
    const store = this.cache.get(key);
    if (!store || !store.chunks) return [];
    const matches: T[] = [];
    for (const chunk of store.chunks) {
      for (const item of chunk) {
        if (predicate(item)) {
          matches.push(item);
          if (matches.length >= maxResults) return matches;
        }
      }
    }
    return matches;
  }

  public clear(key: string): void {
    this.cache.delete(key);
  }

  public clearAll(): void {
    this.cache.clear();
  }
}

export const chunkCache = new MemoryChunkCacheManager();
