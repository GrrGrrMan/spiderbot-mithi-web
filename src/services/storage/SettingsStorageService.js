// src/services/storage/SettingsStorageService.js
import { createStorageAdapter } from "./storageAdapter"
import { STORAGE_KEY, DEFAULT_APP_SETTINGS } from "./schemaDefaults"
import { migrateSettings, deepMerge } from "./migrations"

class SettingsStorageService {
    constructor() {
        this.adapter = createStorageAdapter()
        this.settings = { ...DEFAULT_APP_SETTINGS }
        this.listeners = new Set()
        this.debounceTimers = new Map()
        this.isInitialized = false

        this._init()
    }

    _init() {
        if (this.isInitialized) return
        this.isInitialized = true

        this._rehydrate()
        this._bindCrossTabListener()
    }

    _rehydrate() {
        const raw = this.adapter.getItem(STORAGE_KEY)
        if (!raw) {
            this.settings = { ...DEFAULT_APP_SETTINGS, _updatedAt: Date.now() }
            return
        }

        try {
            const parsed = JSON.parse(raw)
            this.settings = migrateSettings(parsed)
        } catch (err) {
            console.error("[SettingsStorageService] Failed to parse cached configuration, resetting to defaults:", err)
            this.settings = { ...DEFAULT_APP_SETTINGS, _updatedAt: Date.now() }
        }
    }

    _bindCrossTabListener() {
        if (typeof window === "undefined" || !window.addEventListener) return

        window.addEventListener("storage", event => {
            if (event.key === STORAGE_KEY && event.newValue) {
                try {
                    const incoming = JSON.parse(event.newValue)
                    const migrated = migrateSettings(incoming)
                    this.settings = migrated
                    this._notifySubscribers(null)
                } catch (err) {
                    console.warn("[SettingsStorageService] Cross-tab storage sync parse failed:", err)
                }
            }
        })
    }

    _notifySubscribers(sliceKey) {
        this.listeners.forEach(callback => {
            try {
                callback(this.settings, sliceKey)
            } catch (err) {
                console.error("[SettingsStorageService] Error in subscriber callback:", err)
            }
        })
    }

    _persistSync() {
        this.settings._updatedAt = Date.now()

        // Sanitize sensitive credentials before writing to disk
        const payloadToSave = deepMerge(this.settings, {})
        if (!payloadToSave.mqtt.rememberAuth) {
            payloadToSave.mqtt.password = ""
        }

        this.adapter.setItem(STORAGE_KEY, JSON.stringify(payloadToSave))
    }

    /**
     * Subscribe to configuration changes.
     * @param {function} callback - Receives (settings, changedSlice)
     * @returns {function} Unsubscribe handler
     */
    subscribe(callback) {
        this.listeners.add(callback)
        return () => this.listeners.delete(callback)
    }

    getSettings() {
        return this.settings
    }

    getSlice(sliceKey) {
        return this.settings[sliceKey] !== undefined ? this.settings[sliceKey] : null
    }

    /**
     * Mutate a configuration slice with debounced disk write.
     */
    setSlice(sliceKey, partialData, { debounceMs = 0 } = {}) {
        if (!sliceKey || !this.settings[sliceKey] || typeof partialData !== "object") return

        this.settings[sliceKey] = deepMerge(this.settings[sliceKey], partialData)
        this._notifySubscribers(sliceKey)

        if (debounceMs <= 0) {
            if (this.debounceTimers.has(sliceKey)) {
                clearTimeout(this.debounceTimers.get(sliceKey))
                this.debounceTimers.delete(sliceKey)
            }
            this._persistSync()
            return
        }

        if (this.debounceTimers.has(sliceKey)) {
            clearTimeout(this.debounceTimers.get(sliceKey))
        }

        const timer = setTimeout(() => {
            this.debounceTimers.delete(sliceKey)
            this._persistSync()
        }, debounceMs)

        this.debounceTimers.set(sliceKey, timer)
    }

    /**
     * Set a specific property within a slice.
     */
    setPath(sliceKey, key, value, options = {}) {
        this.setSlice(sliceKey, { [key]: value }, options)
    }

    flush() {
        this.debounceTimers.forEach(timer => clearTimeout(timer))
        this.debounceTimers.clear()
        this._persistSync()
    }

    resetSlice(sliceKey) {
        if (!DEFAULT_APP_SETTINGS[sliceKey]) return
        this.settings[sliceKey] = JSON.parse(JSON.stringify(DEFAULT_APP_SETTINGS[sliceKey]))
        this._persistSync()
        this._notifySubscribers(sliceKey)
    }

    resetAll() {
        this.settings = JSON.parse(JSON.stringify(DEFAULT_APP_SETTINGS))
        this.settings._updatedAt = Date.now()
        this._persistSync()
        this._notifySubscribers(null)
    }

    exportBackup() {
        const exported = deepMerge(this.settings, {})
        // Guarantee password is never leaked into backup JSON
        if (exported.mqtt) exported.mqtt.password = ""
        return JSON.stringify(exported, null, 2)
    }

    importBackup(jsonString) {
        try {
            const parsed = JSON.parse(jsonString)
            if (!parsed || typeof parsed !== "object") {
                return { success: false, error: "Invalid JSON format." }
            }
            this.settings = migrateSettings(parsed)
            this._persistSync()
            this._notifySubscribers(null)
            return { success: true }
        } catch (err) {
            return { success: false, error: err.message }
        }
    }
}

export const settingsStorage = new SettingsStorageService()
export default settingsStorage