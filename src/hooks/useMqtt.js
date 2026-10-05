// src/hooks/useMqtt.js
import { useState, useEffect, useCallback, useRef } from "react"
import mqtt from "mqtt"
import { settingsStorage } from "../services/storage"
import { resolveMqttBrokerUrl, resolvePiHost } from "../utils/networkConfig"

/**
 * Builds the initial connection configuration, prioritizing URL query parameters
 * over saved localStorage settings, falling back to networkConfig defaults.
 */
function resolveInitialConfig(searchParams) {
    const cachedMqtt = settingsStorage.getSlice("mqtt") || {}
    const queryBroker = searchParams?.get("broker")
    const queryDevice = searchParams?.get("device")
    const queryCam = searchParams?.get("cam")

    const fallbackUrl = resolveMqttBrokerUrl(searchParams)
    const effectiveBrokerUrl = queryBroker ? fallbackUrl : (cachedMqtt.brokerUrl || fallbackUrl)
    const effectiveDeviceId = queryDevice || cachedMqtt.deviceId || "hexapod-s3-01"
    const effectiveCamId = queryCam || cachedMqtt.camDeviceId || "hexapod-cam-01"

    return {
        ...cachedMqtt,
        brokerUrl: effectiveBrokerUrl,
        deviceId: effectiveDeviceId,
        camDeviceId: effectiveCamId,
        topicPrefix: cachedMqtt.topicPrefix || "hexapod",
        username: cachedMqtt.username || "",
        password: cachedMqtt.password || "",
        clean: cachedMqtt.clean !== undefined ? cachedMqtt.clean : true,
        keepalive: cachedMqtt.keepalive || 60,
        reconnectPeriod: cachedMqtt.reconnectPeriod || 4000,
    }
}

export function useMqtt(brokerUrlOverride = null, deviceIdOverride = null) {
    const searchParamsRef = useRef(
        typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
    )

    const [activeConfig, setActiveConfig] = useState(() => {
        const init = resolveInitialConfig(searchParamsRef.current)
        if (brokerUrlOverride) init.brokerUrl = brokerUrlOverride
        if (deviceIdOverride) init.deviceId = deviceIdOverride
        return init
    })

    // Connection lifecycle states
    const [isConnected, setIsConnected] = useState(false)
    const [isConnecting, setIsConnecting] = useState(false)
    const [connectionError, setConnectionError] = useState(null)
    const [latencyRtt, setLatencyRtt] = useState(null)

    // Hardware Telemetry & Message states
    const [telemetry, setTelemetry] = useState(null)
    const [logs, setLogs] = useState([])
    const [config, setConfig] = useState(null)
    const [camTelemetry, setCamTelemetry] = useState(null)
    const [camConfig, setCamConfig] = useState(null)
    const [aiMessages, setAiMessages] = useState([])
    const [aiStatus, setAiStatus] = useState(null)
    const [audioStatus, setAudioStatus] = useState(null)
    const [memoryState, setMemoryState] = useState(null)

    const clientRef = useRef(null)
    const activeConfigRef = useRef(activeConfig)
    activeConfigRef.current = activeConfig

    // Throttled publish buffers
    const lastPublishRef = useRef(0)
    const pendingPublishRef = useRef(null)
    const trailingTimerRef = useRef(null)

    // 2Hz Telemetry throttle guards
    const lastTelemetryUpdateRef = useRef(0)
    const lastCamTelemetryUpdateRef = useRef(0)
    const pendingTelemetryRef = useRef(null)
    const trailingTelemetryTimerRef = useRef(null)

    const clearLogs = useCallback(() => setLogs([]), [])
    const clearAiMessages = useCallback(() => setAiMessages([]), [])

    // Safety watchdog: clear 'playing' lock if firmware packet is lost
    const isAudioPlaying = audioStatus?.state === "playing"
    useEffect(() => {
        if (isAudioPlaying) {
            const timer = setTimeout(() => {
                setAudioStatus(prev => (prev?.state === "playing" ? { state: "idle", action: "timeout" } : prev))
            }, 8000)
            return () => clearTimeout(timer)
        }
    }, [isAudioPlaying])

    // Primary connection lifecycle effect
    useEffect(() => {
        const conf = activeConfig
        const resolvedUrl = conf.brokerUrl
        const prefix = conf.topicPrefix || "hexapod"
        const deviceId = conf.deviceId
        const camDeviceId = conf.camDeviceId

        setIsConnecting(true)
        setConnectionError(null)

        const clientOptions = {
            clientId: `web-ui-${Math.random().toString(16).substr(2, 8)}`,
            clean: conf.clean,
            keepalive: conf.keepalive,
            reconnectPeriod: conf.reconnectPeriod,
        }

        if (conf.username) clientOptions.username = conf.username
        if (conf.password) clientOptions.password = conf.password

        const client = mqtt.connect(resolvedUrl, clientOptions)
        clientRef.current = client

        client.on("connect", () => {
            setIsConnected(true)
            setIsConnecting(false)
            setConnectionError(null)

            // Subscribe to canonical hardware and AI topics
            client.subscribe(`${prefix}/${deviceId}/telemetry`)
            client.subscribe(`${prefix}/${deviceId}/logs`)
            client.subscribe(`${prefix}/${deviceId}/config`)
            client.subscribe(`${prefix}/${deviceId}/ai`)
            client.subscribe(`${prefix}/${deviceId}/ai/status`)
            client.subscribe(`${prefix}/${deviceId}/audio/status`)
            client.subscribe(`${prefix}/${deviceId}/ai/memory/state`)

            if (camDeviceId) {
                client.subscribe(`${prefix}/${camDeviceId}/telemetry`)
                client.subscribe(`${prefix}/${camDeviceId}/config`)
            }
        })

        client.on("reconnect", () => {
            setIsConnecting(true)
        })

        client.on("close", () => {
            setIsConnected(false)
            setIsConnecting(false)
        })

        client.on("error", err => {
            setConnectionError(err.message || "MQTT connection error")
            setIsConnecting(false)
        })

        client.on("message", (topic, message) => {
            const payload = message.toString()
            const isCamTopic = camDeviceId && topic.startsWith(`${prefix}/${camDeviceId}/`)

            if (topic.endsWith("/telemetry")) {
                try {
                    const parsed = JSON.parse(payload)
                    const now = Date.now()

                    // Estimate ping latency if packet includes hardware timestamp
                    if (parsed.timestamp) {
                        setLatencyRtt(Math.max(1, Math.round(now - parsed.timestamp)))
                    }

                    if (isCamTopic) {
                        if (now - lastCamTelemetryUpdateRef.current > 500) {
                            setCamTelemetry(parsed)
                            lastCamTelemetryUpdateRef.current = now
                        }
                    } else {
                        // Throttle React renders to 2Hz with guaranteed trailing resolution
                        const elapsed = now - lastTelemetryUpdateRef.current
                        if (elapsed > 500) {
                            setTelemetry(parsed)
                            lastTelemetryUpdateRef.current = now
                            pendingTelemetryRef.current = null
                            if (trailingTelemetryTimerRef.current) {
                                clearTimeout(trailingTelemetryTimerRef.current)
                                trailingTelemetryTimerRef.current = null
                            }
                        } else {
                            pendingTelemetryRef.current = parsed
                            if (!trailingTelemetryTimerRef.current) {
                                trailingTelemetryTimerRef.current = setTimeout(() => {
                                    trailingTelemetryTimerRef.current = null
                                    if (pendingTelemetryRef.current) {
                                        setTelemetry(pendingTelemetryRef.current)
                                        lastTelemetryUpdateRef.current = Date.now()
                                        pendingTelemetryRef.current = null
                                    }
                                }, 500 - elapsed)
                            }
                        }

                        if (parsed.audio) {
                            setAudioStatus(prev => {
                                if (prev?.state === parsed.audio) return prev
                                return { state: parsed.audio, action: prev?.action || "tts" }
                            })
                        }
                    }
                } catch (e) {
                    console.error("[MQTT WebUI] Telemetry JSON parse error:", e)
                }
            } else if (topic.endsWith("/config")) {
                try {
                    const parsed = JSON.parse(payload)
                    if (isCamTopic) setCamConfig(parsed)
                    else setConfig(parsed)
                } catch (e) {}
            } else if (topic.endsWith("/logs") && !isCamTopic) {
                setLogs(prev => [...prev.slice(-99), payload])
            } else if (topic.endsWith("/ai") && !isCamTopic) {
                try {
                    const msg = JSON.parse(payload)
                    if (msg.type === "audio" || msg.action === "tts") return
                    setAiMessages(prev => [...prev.slice(-49), msg])
                } catch (e) {}
            } else if (topic.endsWith("/ai/status") && !isCamTopic) {
                try {
                    const statusObj = JSON.parse(payload)
                    setAiStatus(statusObj)
                    if (statusObj.memory) setMemoryState(statusObj.memory)
                } catch (e) {}
            } else if (topic.endsWith("/ai/memory/state") && !isCamTopic) {
                try {
                    setMemoryState(JSON.parse(payload))
                } catch (e) {}
            } else if (topic.endsWith("/audio/status") && !isCamTopic) {
                try {
                    setAudioStatus(JSON.parse(payload))
                } catch (e) {}
            }
        })

        return () => {
            if (client) {
                client.end(false)
            }
        }
    }, [activeConfig])

    // Periodic heartbeat loop
    useEffect(() => {
        if (!isConnected || !clientRef.current) return
        const prefix = activeConfig.topicPrefix || "hexapod"
        const targetTopic = `${prefix}/${activeConfig.deviceId}/heartbeat`

        const heartbeatInterval = setInterval(() => {
            try {
                clientRef.current.publish(
                    targetTopic,
                    JSON.stringify({ type: "heartbeat", timestamp: Date.now() })
                )
            } catch (err) {}
        }, 3000)

        return () => clearInterval(heartbeatInterval)
    }, [isConnected, activeConfig])

    // Hot-swap broker connection dynamically
    const connectToBroker = useCallback((newConfig) => {
        setActiveConfig(prev => {
            const merged = { ...prev, ...newConfig }
            settingsStorage.setSlice("mqtt", merged)
            return merged
        })
    }, [])

    const disconnect = useCallback(() => {
        if (clientRef.current) {
            clientRef.current.end(false)
            setIsConnected(false)
            setIsConnecting(false)
        }
    }, [])

    const reconnect = useCallback(() => {
        setActiveConfig(prev => ({ ...prev }))
    }, [])

    const publishImmediate = useCallback((topic, payload) => {
        if (!clientRef.current || !isConnected) return
        const prefix = activeConfigRef.current.topicPrefix || "hexapod"
        const deviceId = activeConfigRef.current.deviceId
        const targetTopic = topic === "hexapod/cmd" ? `${prefix}/${deviceId}/cmd` : topic
        clientRef.current.publish(targetTopic, JSON.stringify(payload))
    }, [isConnected])

    const publishThrottled = useCallback((topic, payload) => {
        if (!clientRef.current || !isConnected) return
        const prefix = activeConfigRef.current.topicPrefix || "hexapod"
        const deviceId = activeConfigRef.current.deviceId
        const targetTopic = topic === "hexapod/cmd" ? `${prefix}/${deviceId}/cmd` : topic
        const now = Date.now()
        const elapsed = now - lastPublishRef.current

        if (elapsed >= 100) {
            clientRef.current.publish(targetTopic, JSON.stringify(payload))
            lastPublishRef.current = now
            pendingPublishRef.current = null
            if (trailingTimerRef.current) {
                clearTimeout(trailingTimerRef.current)
                trailingTimerRef.current = null
            }
            return
        }

        pendingPublishRef.current = { targetTopic, payload }
        if (!trailingTimerRef.current) {
            trailingTimerRef.current = setTimeout(() => {
                trailingTimerRef.current = null
                if (!pendingPublishRef.current || !clientRef.current) return
                const { targetTopic: t, payload: p } = pendingPublishRef.current
                clientRef.current.publish(t, JSON.stringify(p))
                lastPublishRef.current = Date.now()
                pendingPublishRef.current = null
            }, 100 - elapsed)
        }
    }, [isConnected])

    const publishAi = useCallback((payload) => {
        if (!clientRef.current || !isConnected) return
        const prefix = activeConfigRef.current.topicPrefix || "hexapod"
        clientRef.current.publish(`${prefix}/${activeConfigRef.current.deviceId}/ai`, JSON.stringify(payload))
    }, [isConnected])

    const publishAiConfig = useCallback((payload) => {
        if (!clientRef.current || !isConnected) return
        const prefix = activeConfigRef.current.topicPrefix || "hexapod"
        clientRef.current.publish(`${prefix}/${activeConfigRef.current.deviceId}/ai/config`, JSON.stringify(payload))
    }, [isConnected])

    const publishAiMemory = useCallback((payload) => {
        if (!clientRef.current || !isConnected) return
        const prefix = activeConfigRef.current.topicPrefix || "hexapod"
        clientRef.current.publish(`${prefix}/${activeConfigRef.current.deviceId}/ai/memory/cmd`, JSON.stringify(payload))
    }, [isConnected])

    const publishAudio = useCallback((payload) => {
        if (!clientRef.current || !isConnected) return
        const prefix = activeConfigRef.current.topicPrefix || "hexapod"
        clientRef.current.publish(`${prefix}/${activeConfigRef.current.deviceId}/audio`, JSON.stringify(payload))
    }, [isConnected])

    return {
        // Connection lifecycle & Diagnostics
        isConnected,
        isConnecting,
        connectionError,
        latencyRtt,
        activeConfig,
        connectToBroker,
        disconnect,
        reconnect,

        // Telemetry & Hardware Config
        telemetry,
        logs,
        config,
        deviceId: activeConfig.deviceId,
        camDeviceId: activeConfig.camDeviceId,
        camTelemetry,
        camConfig,

        // AI & Audio streams
        aiMessages,
        aiStatus,
        audioStatus,
        memoryState,

        // Publishers & actions
        publishThrottled,
        publishImmediate,
        publishAi,
        publishAiConfig,
        publishAiMemory,
        publishAudio,
        clearLogs,
        clearAiMessages,
    }
}

export default useMqtt