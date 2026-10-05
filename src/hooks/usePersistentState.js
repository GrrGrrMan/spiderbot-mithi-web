// src/hooks/usePersistentState.js
import { useState, useEffect, useCallback, useRef } from "react"
import { settingsStorage } from "../services/storage"

/**
 * Idiomatic React hook binding a component to a slice of SettingsStorageService.
 *
 * @param {string} sliceKey - Name of the slice ("mqtt", "llm", "memory", "ui", etc.)
 * @param {object} [options]
 * @param {number} [options.debounceMs=0] - Debounce period in ms before writing to disk
 * @returns {[object, function, function]} [sliceState, updateSlice, resetSlice]
 */
export function usePersistentState(sliceKey, options = {}) {
    const { debounceMs = 0 } = options
    const [state, setState] = useState(() => settingsStorage.getSlice(sliceKey))

    const sliceKeyRef = useRef(sliceKey)
    sliceKeyRef.current = sliceKey

    const debounceMsRef = useRef(debounceMs)
    debounceMsRef.current = debounceMs

    // Subscribe to internal mutations, cross-tab events, or backup imports
    useEffect(() => {
        const unsubscribe = settingsStorage.subscribe((allSettings, changedSlice) => {
            if (!changedSlice || changedSlice === sliceKeyRef.current) {
                const freshSlice = settingsStorage.getSlice(sliceKeyRef.current)
                setState(freshSlice)
            }
        })
        return () => unsubscribe()
    }, [sliceKey])

    const updateSlice = useCallback((partialOrFn) => {
        setState(prev => {
            const patch = typeof partialOrFn === "function" ? partialOrFn(prev) : partialOrFn
            if (!patch || typeof patch !== "object") return prev

            // Update underlying storage service
            settingsStorage.setSlice(sliceKeyRef.current, patch, {
                debounceMs: debounceMsRef.current,
            })

            return { ...prev, ...patch }
        })
    }, [])

    const resetSlice = useCallback(() => {
        settingsStorage.resetSlice(sliceKeyRef.current)
    }, [])

    return [state, updateSlice, resetSlice]
}

export default usePersistentState