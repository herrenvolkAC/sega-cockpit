type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export class MemoryCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlSeconds: number) {}

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.ttlSeconds <= 0) return;
    const expiresAt = Date.now() + this.ttlSeconds * 1000;
    this.store.set(key, { expiresAt, value });
  }
}
