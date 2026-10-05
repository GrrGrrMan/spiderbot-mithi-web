// src/services/storage/migrations.js
import { SCHEMA_VERSION, DEFAULT_APP_SETTINGS } from "./schemaDefaults"

/**
 * Deep merge utility to safely overlay loaded data on top of default values.
 * Ensures arrays and objects do not get wiped or share references.
 */
export function deepMerge(target, source) {
    if (!source || typeof source !== "object") return target

    const output = Array.isArray(target) ? [...target] : { ...target }

    Object.keys(source).forEach(key => {
        const sourceVal = source[key]
        const targetVal = target ? target[key] : undefined

        if (
            sourceVal &&
            typeof sourceVal === "object" &&
            !Array.isArray(sourceVal) &&
            targetVal &&
            typeof targetVal === "object" &&
            !Array.isArray(targetVal)
        ) {
            output[key] = deepMerge(targetVal, sourceVal)
        } else if (sourceVal !== undefined) {
            output[key] = sourceVal
        }
    })

    return output
}

/**
 * Migrates data structures across schema versions.
 */
export function migrateSettings(rawParsed) {
    if (!rawParsed || typeof rawParsed !== "object") {
        return { ...DEFAULT_APP_SETTINGS, _updatedAt: Date.now() }
    }

    let current = { ...rawParsed }
    const version = current._version || 0

    // Sequential version migrations
    if (version < 1) {
        // v0 -> v1: Normalize root fields into domain slices
        const legacyMqttUrl = current.brokerUrl || current.mqttBroker
        const legacyDeviceId = current.deviceId
        
        current = {
            ...DEFAULT_APP_SETTINGS,
            ...current,
            mqtt: {
                ...DEFAULT_APP_SETTINGS.mqtt,
                ...(legacyMqttUrl ? { brokerUrl: legacyMqttUrl } : {}),
                ...(legacyDeviceId ? { deviceId: legacyDeviceId } : {}),
                ...(current.mqtt || {}),
            },
            _version: 1,
        }
    }

    // Always deep-merge with defaults to guarantee all expected keys exist
    const merged = deepMerge(DEFAULT_APP_SETTINGS, current)
    merged._version = SCHEMA_VERSION

    return merged
}