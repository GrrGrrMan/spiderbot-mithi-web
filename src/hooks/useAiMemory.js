// web-ui/src/hooks/useAiMemory.js
import { useState, useEffect, useCallback } from "react"
import { settingsStorage } from "../services/storage"

export const useAiMemory = ({ memoryState = null, publishAiMemory = () => {}, aiStatus = null }) => {
    const cachedMemory = settingsStorage.getSlice("memory") || {}
    const incoming = memoryState || aiStatus?.memory || {
        mode: cachedMemory.mode || "session",
        turns_count: 0,
        pool_count: Object.keys(cachedMemory.memoryPool || {}).length,
        memory_pool: cachedMemory.memoryPool || {},
    }

    const [mode, setLocalMode] = useState(incoming.mode || cachedMemory.mode || "session")
    const [turnsCount, setLocalTurns] = useState(incoming.turns_count || 0)
    const [memoryPool, setLocalPool] = useState(incoming.memory_pool || cachedMemory.memoryPool || {})
    const [notice, setNotice] = useState(null)

    // Sync from incoming MQTT heartbeat or topic updates
    const aiMemory = aiStatus?.memory
    useEffect(() => {
        const src = memoryState || aiMemory
        if (src) {
            if (src.mode) {
                setLocalMode(src.mode)
                settingsStorage.setSlice("memory", { mode: src.mode })
            }
            if (src.turns_count !== undefined) setLocalTurns(src.turns_count)
            if (src.memory_pool) {
                setLocalPool(src.memory_pool)
                settingsStorage.setSlice("memory", { memoryPool: src.memory_pool })
            }
        }
    }, [memoryState, aiMemory])

    // Cross-tab synchronization for AI memory
    useEffect(() => {
        const unsubscribe = settingsStorage.subscribe((allSettings, sliceKey) => {
            if (!sliceKey || sliceKey === "memory") {
                const fresh = settingsStorage.getSlice("memory")
                if (fresh) {
                    if (fresh.mode) setLocalMode(fresh.mode)
                    if (fresh.memoryPool) setLocalPool(fresh.memoryPool)
                }
            }
        })
        return () => unsubscribe()
    }, [])

    const showNotice = (msg) => {
        setNotice(msg)
        setTimeout(() => setNotice(null), 2000)
    }

    const setMode = useCallback((newMode) => {
        setLocalMode(newMode)
        settingsStorage.setSlice("memory", { mode: newMode })
        publishAiMemory({ action: "set_mode", mode: newMode })
        showNotice(`Mode: ${newMode.toUpperCase()}`)
    }, [publishAiMemory])

    const setFact = useCallback((key, value) => {
        const k = key.trim()
        const v = value.trim()
        if (!k || !v) return
        setLocalPool(prev => {
            const next = { ...prev, [k]: v }
            settingsStorage.setSlice("memory", { memoryPool: next })
            return next
        })
        publishAiMemory({ action: "set_fact", key: k, value: v })
        showNotice(`Saved: ${k}`)
    }, [publishAiMemory])

    const deleteFact = useCallback((key) => {
        if (!key) return
        setLocalPool(prev => {
            const next = { ...prev }
            delete next[key]
            settingsStorage.setSlice("memory", { memoryPool: next })
            return next
        })
        publishAiMemory({ action: "delete_fact", key })
        showNotice(`Deleted: ${key}`)
    }, [publishAiMemory])

    const clearSession = useCallback(() => {
        setLocalTurns(0)
        publishAiMemory({ action: "clear_session" })
        showNotice("Session cleared")
    }, [publishAiMemory])

    const wipeAll = useCallback(() => {
        if (window.confirm("⚠️ Factory Reset: Wipe ALL session turns and persistent pool facts?")) {
            setLocalTurns(0)
            setLocalPool({})
            settingsStorage.setSlice("memory", { mode: "session", memoryPool: {} })
            publishAiMemory({ action: "clear_all" })
            showNotice("All memory wiped")
        }
    }, [publishAiMemory])

    return {
        mode,
        turnsCount,
        memoryPool,
        notice,
        setMode,
        setFact,
        deleteFact,
        clearSession,
        wipeAll,
    }
}

export default useAiMemory