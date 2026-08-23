// web-ui/src/hooks/useMqtt.js
import { useState, useEffect, useCallback, useRef } from "react"
import mqtt from "mqtt"
import { resolveMqttBrokerUrl } from "../utils/networkConfig"

const getDeviceId = (defaultId = "hexapod-s3-01") => {
    if (typeof window === "undefined") return defaultId
    const params = new URLSearchParams(window.location.search)
    return params.get("device") || defaultId
}

const getCameraDeviceId = (defaultId = "hexapod-cam-01") => {
    if (typeof window === "undefined") return defaultId
    const params = new URLSearchParams(window.location.search)
    return params.get("cam") || defaultId
}

export function useMqtt(brokerUrlOverride = null, deviceIdOverride = null) {
    const searchParamsRef = useRef(typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null)
    const deviceId = deviceIdOverride || getDeviceId()
    const camDeviceId = getCameraDeviceId()

    const [isConnected, setIsConnected] = useState(false)
    const [telemetry, setTelemetry] = useState(null)
    const [logs, setLogs] = useState([])
    const [config, setConfig] = useState(null)
    const [camTelemetry, setCamTelemetry] = useState(null)
    const [camConfig, setCamConfig] = useState(null)
    const [aiMessages, setAiMessages] = useState([])
    const [aiStatus, setAiStatus] = useState(null)
    const [audioStatus, setAudioStatus] = useState(null)

    const clientRef = useRef(null)
    const lastPublishRef = useRef(0)
    const pendingPublishRef = useRef(null)
    const trailingTimerRef = useRef(null)

    const clearLogs = useCallback(() => setLogs([]), [])
    const clearAiMessages = useCallback(() => setAiMessages([]), [])

    useEffect(() => {
        const resolvedUrl = brokerUrlOverride || resolveMqttBrokerUrl(searchParamsRef.current)
        console.log(`[MQTT WebUI] Connecting to Pi Broker: ${resolvedUrl}`)

        const client = mqtt.connect(resolvedUrl, {
            clientId: `web-ui-${Math.random().toString(16).substr(2, 8)}`,
            clean: true,
            reconnectPeriod: 4000,
        })

        client.on("connect", () => {
            setIsConnected(true)
            client.subscribe(`hexapod/${deviceId}/telemetry`)
            client.subscribe(`hexapod/${deviceId}/logs`)
            client.subscribe(`hexapod/${deviceId}/config`)
            client.subscribe(`hexapod/${deviceId}/ai`)
            client.subscribe(`hexapod/${deviceId}/ai/status`)
            client.subscribe(`hexapod/${deviceId}/audio/status`)

            if (camDeviceId) {
                client.subscribe(`hexapod/${camDeviceId}/telemetry`)
                client.subscribe(`hexapod/${camDeviceId}/config`)
            }
            console.log(`[MQTT WebUI] Subscribed to [${deviceId}] & [${camDeviceId}]`)
        })

        client.on("close", () => setIsConnected(false))
        client.on("error", (err) => console.warn("[MQTT WebUI] Error:", err))

        client.on("message", (topic, message) => {
            const payload = message.toString()
            const isCamTopic = camDeviceId && topic.startsWith(`hexapod/${camDeviceId}/`)

            if (topic.endsWith("/telemetry")) {
                try {
                    const parsed = JSON.parse(payload)
                    if (isCamTopic) {
                        setCamTelemetry(parsed)
                    } else {
                        setTelemetry(parsed)
                        if (parsed.audio) {
                            setAudioStatus(prev => ({
                                state: parsed.audio,
                                action: prev?.action || "tts"
                            }))
                        }
                        if (parsed.pose && typeof window !== "undefined") {
                            window.dispatchEvent(
                                new CustomEvent("hexapod-telemetry-frame", { detail: parsed.pose })
                            )
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
                } catch (e) {
                    console.error("[MQTT WebUI] Config JSON parse error:", e)
                }
            } else if (topic.endsWith("/logs") && !isCamTopic) {
                setLogs(prev => [...prev.slice(-99), payload])
            } else if (topic.endsWith("/ai") && !isCamTopic) {
                try {
                    const msg = JSON.parse(payload)
                    setAiMessages(prev => [...prev.slice(-199), msg])
                } catch (e) {
                    console.error("[MQTT WebUI] AI JSON parse error:", e)
                }
            } else if (topic.endsWith("/ai/status") && !isCamTopic) {
                try {
                    setAiStatus(JSON.parse(payload))
                } catch (e) {
                    console.error("[MQTT WebUI] AI status JSON parse error:", e)
                }
            } else if (topic.endsWith("/audio/status") && !isCamTopic) {
                try {
                    setAudioStatus(JSON.parse(payload))
                } catch (e) {
                    console.error("[MQTT WebUI] Audio status JSON parse error:", e)
                }
            }
        })

        clientRef.current = client

        return () => {
            if (client) client.end()
        }
    }, [brokerUrlOverride, deviceId, camDeviceId])

    // Heartbeat Publisher to S3 Command Queue
    useEffect(() => {
        if (!isConnected || !clientRef.current) return
        const heartbeatInterval = setInterval(() => {
            const targetTopic = `hexapod/${deviceId}/cmd`
            try {
                clientRef.current.publish(targetTopic, JSON.stringify({ type: "heartbeat" }))
            } catch (err) {
                console.error("[MQTT WebUI] Heartbeat error:", err)
            }
        }, 500)
        return () => clearInterval(heartbeatInterval)
    }, [isConnected, deviceId])

    const publishImmediate = useCallback((topic, payload) => {
        if (!clientRef.current || !isConnected) return
        const targetTopic = topic === "hexapod/cmd" ? `hexapod/${deviceId}/cmd` : topic
        clientRef.current.publish(targetTopic, JSON.stringify(payload))
    }, [isConnected, deviceId])

    const publishThrottled = useCallback((topic, payload) => {
        if (!clientRef.current || !isConnected) return
        const targetTopic = topic === "hexapod/cmd" ? `hexapod/${deviceId}/cmd` : topic
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
    }, [isConnected, deviceId])

    const publishAi = useCallback((payload) => {
        if (!clientRef.current || !isConnected) return
        clientRef.current.publish(`hexapod/${deviceId}/ai`, JSON.stringify(payload))
    }, [isConnected, deviceId])

    const publishAudio = useCallback((payload) => {
        if (!clientRef.current || !isConnected) return
        clientRef.current.publish(`hexapod/${deviceId}/audio`, JSON.stringify(payload))
    }, [isConnected, deviceId])

    return {
        isConnected,
        telemetry,
        logs,
        config,
        deviceId,
        camDeviceId,
        camTelemetry,
        camConfig,
        aiMessages,
        aiStatus,
        audioStatus,
        publishThrottled,
        publishImmediate,
        publishAi,
        publishAudio,
        clearLogs,
        clearAiMessages,
    }
}