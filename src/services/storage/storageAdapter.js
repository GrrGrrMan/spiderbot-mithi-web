// src/services/storage/storageAdapter.js

/**
 * In-memory fallback adapter for environments where localStorage is blocked
 * (e.g. private browsing quota exceeded, restrictive sandbox iframes, or disabled cookies).
 */
class MemoryStorageAdapter {
    constructor() {
        this._store = new Map()
    }

    getItem(key) {
        return this._store.has(key) ? this._store.get(key) : null
    }

    setItem(key, value) {
        this._store.set(key, String(value))
        return true
    }

    removeItem(key) {
        return this._store.delete(key)
    }

    clear() {
        this._store.clear()
        return true
    }

    getType() {
        return "memory"
    }

    isAvailable() {
        return true
    }
}

/**
 * LocalStorage adapter with dynamic availability probing and error recovery.
 */
class LocalStorageAdapter {
    constructor() {
        this._type = "localStorage"
    }

    getItem(key) {
        try {
            return window.localStorage.getItem(key)
        } catch (err) {
            console.warn(`[StorageAdapter] Failed to read key "${key}":`, err)
            return null
        }
    }

    setItem(key, value) {
        try {
            window.localStorage.setItem(key, String(value))
            return true
        } catch (err) {
            console.warn(`[StorageAdapter] Failed to set key "${key}":`, err)
            return false
        }
    }

    removeItem(key) {
        try {
            window.localStorage.removeItem(key)
            return true
        } catch (err) {
            console.warn(`[StorageAdapter] Failed to remove key "${key}":`, err)
            return false
        }
    }

    clear() {
        try {
            window.localStorage.clear()
            return true
        } catch (err) {
            console.warn("[StorageAdapter] Failed to clear localStorage:", err)
            return false
        }
    }

    getType() {
        return this._type
    }

    isAvailable() {
        try {
            if (typeof window === "undefined" || !window.localStorage) {
                return false
            }
            const testKey = "__hexapod_probe__"
            window.localStorage.setItem(testKey, "1")
            window.localStorage.removeItem(testKey)
            return true
        } catch (e) {
            return false
        }
    }
}

/**
 * Creates the most resilient available storage adapter.
 */
export function createStorageAdapter() {
    const lsAdapter = new LocalStorageAdapter()
    if (lsAdapter.isAvailable()) {
        return lsAdapter
    }
    console.warn("[StorageAdapter] window.localStorage unavailable. Falling back to in-memory store.")
    return new MemoryStorageAdapter()
}