const CACHE_PREFIX = 'bsfly_cache_';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000;

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

class OfflineService {
    private isOnline: boolean = navigator.onLine;
    private listeners: Set<(online: boolean) => void> = new Set();

    constructor() {
        window.addEventListener('online', () => this.setOnline(true));
        window.addEventListener('offline', () => this.setOnline(false));
    }

    private setOnline(online: boolean) {
        this.isOnline = online;
        this.listeners.forEach(cb => cb(online));
    }

    getOnlineStatus(): boolean {
        return this.isOnline;
    }

    subscribe(callback: (online: boolean) => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    set<T>(key: string, data: T): void {
        try {
            const entry: CacheEntry<T> = {
                data,
                timestamp: Date.now()
            };
            localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
        } catch {
        }
    }

    get<T>(key: string): T | null {
        try {
            const item = localStorage.getItem(CACHE_PREFIX + key);
            if (!item) return null;

            const entry: CacheEntry<T> = JSON.parse(item);
            if (Date.now() - entry.timestamp > CACHE_EXPIRY) {
                localStorage.removeItem(CACHE_PREFIX + key);
                return null;
            }
            return entry.data;
        } catch {
            return null;
        }
    }

    remove(key: string): void {
        localStorage.removeItem(CACHE_PREFIX + key);
    }

    clear(): void {
        Object.keys(localStorage)
            .filter(key => key.startsWith(CACHE_PREFIX))
            .forEach(key => localStorage.removeItem(key));
    }
}

export const offlineService = new OfflineService();
