// web-ui/src/hooks/useMqtt.js
import { useState, useEffect, useCallback, useRef } from "react"
import mqtt from "mqtt"

const getBrokerUrl = () => {
    const params = new URLSearchParams(window.location.search)
    const queryBroker = params.get("broker")

    const isHttps = window.location.protocol === "https:"
    const wsScheme = isHttps ? "wss" : "ws"
    const wsPort = isHttps ? "9443" : "9001"

    // 1. Explicit query override: ?broker=192.168.1.50
    if (queryBroker) {
        return `${wsScheme}://${queryBroker}:${wsPort}`
    }

    // 2. Local dev server on PC pointing to Pi on mDNS/hotspot
    const hostname = window.location.hostname
    if (hostname === "localhost" || hostname === "127.0.0.1") {
        return "ws://spider-w.local:9001" // or "ws://192.168.4.1:9001"
    }

    // 3. Production build served from Pi Nginx (auto-resolves current Pi IP)
    return `${wsScheme}://${hostname}:${wsPort}`
}

const resolveTopic = (topic, deviceId) => {
    if (!topic || topic === "hexapod/cmd") {
        return `hexapod/${deviceId}/cmd`
    }
    return topic
}

const getDeviceId = (defaultId = "hexapod-s3-01") => {
    const params = new URLSearchParams(window.location.search)
    const queryDevice = params.get("device")
    return queryDevice || defaultId
}

const getCameraDeviceId = (defaultId = "hexapod-cam-01") => {
    const params = new URLSearchParams(window.location.search)
    const queryCam = params.get("cam")
    return queryCam || defaultId
}

export function useMqtt(brokerUrlOverride = null, deviceIdOverride = null) {
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

    const clearLogs = useCallback(() => {
        setLogs([])
    }, [])

    const clearAiMessages = useCallback(() => {
        setAiMessages([])
    }, [])

    useEffect(() => {
        const resolvedUrl = brokerUrlOverride || getBrokerUrl()
        console.log(`[MQTT WebUI] Attempting WebSocket connection to: ${resolvedUrl}`)

        const client = mqtt.connect(resolvedUrl, {
            clientId: `web-ui-${Math.random().toString(16).substr(2, 8)}`,
            clean: true,
            reconnectPeriod: 5000,
        })

        client.on("connect", () => {
            setIsConnected(true)
            client.subscribe(`hexapod/${deviceId}/telemetry`)
            client.subscribe(`hexapod/${deviceId}/logs`)
            client.subscribe(`hexapod/${deviceId}/config`)
            client.subscribe(`hexapod/${deviceId}/ai`)
            client.subscribe(`hexapod/${deviceId}/ai/status`)
            client.subscribe(`hexapod/${deviceId}/audio/status`)

            if (camDeviceId && camDeviceId !== deviceId) {
                client.subscribe(`hexapod/${camDeviceId}/telemetry`)
                client.subscribe(`hexapod/${camDeviceId}/config`)
            }
            console.log(`[MQTT WebUI] Connected and subscribed to device: ${deviceId} (cam: ${camDeviceId})`)
        })

        client.on("close", () => {
            setIsConnected(false)
        })

        client.on("message", (topic, message) => {
            const payload = message.toString()
            const isCamTopic = camDeviceId && topic.startsWith(`hexapod/${camDeviceId}/`)

            if (topic.endsWith("telemetry")) {
                try {
                    const parsed = JSON.parse(payload)
                    if (isCamTopic) {
                        setCamTelemetry(parsed)
                    } else {
                        setTelemetry(parsed)
                        
                        // Sync audio status from telemetry heartbeat if available
                        if (parsed.audio) {
                            setAudioStatus(prev => ({
                                state: parsed.audio,
                                action: (prev && prev.action) || "tts"
                            }))
                        }

                        if (parsed.pose && typeof window !== "undefined") {
                            window.dispatchEvent(
                                new CustomEvent("hexapod-telemetry-frame", { detail: parsed.pose })
                            )
                        }
                    }
                } catch (e) {
                    console.error("[MQTT WebUI] Telemetry parse error:", e)
                }
            } else if (topic.endsWith("config")) {
                try {
                    const parsed = JSON.parse(payload)
                    if (isCamTopic) {
                        setCamConfig(parsed)
                    } else {
                        setConfig(parsed)
                    }
                    console.log("[MQTT WebUI] Configuration handshake received:", payload)
                } catch (e) {
                    console.error("[MQTT WebUI] Config parse error:", e)
                }
            } else if (topic.endsWith("logs") && !isCamTopic) {
                setLogs(prev => [...prev.slice(-99), payload])
            } else if (topic.endsWith("/ai") && !isCamTopic) {
                try {
                    const msg = JSON.parse(payload)
                    setAiMessages(prev => [...prev.slice(-199), msg])
                } catch (e) {
                    console.error("[MQTT WebUI] AI message parse error:", e)
                }
            } else if (topic.endsWith("ai/status") && !isCamTopic) {
                try {
                    setAiStatus(JSON.parse(payload))
                } catch (e) {
                    console.error("[MQTT WebUI] AI status parse error:", e)
                }
            } else if (topic.endsWith("audio/status") && !isCamTopic) {
                try {
                    setAudioStatus(JSON.parse(payload))
                } catch (e) {
                    console.error("[MQTT WebUI] Audio status parse error:", e)
                }
            }
        })

        clientRef.current = client

        return () => {
            if (client) {
                client.end()
            }
        }
    }, [brokerUrlOverride, deviceId, camDeviceId])

    useEffect(() => {
        if (!isConnected || !clientRef.current) return

        const heartbeatInterval = setInterval(() => {
            const targetTopic = `hexapod/${deviceId}/cmd`
            const payload = JSON.stringify({ type: "heartbeat" })
            try {
                clientRef.current.publish(targetTopic, payload)
            } catch (err) {
                console.error("[MQTT WebUI] Heartbeat publish failed:", err)
            }
        }, 500)

        return () => {
            clearInterval(heartbeatInterval)
        }
    }, [isConnected, deviceId])

    useEffect(() => {
        return () => {
            if (trailingTimerRef.current) clearTimeout(trailingTimerRef.current)
        }
    }, [])

    const publishThrottled = useCallback((topic, payload) => {
        if (!clientRef.current || !isConnected) return
        const targetTopic = resolveTopic(topic, deviceId)
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

    const publishImmediate = useCallback((topic, payload) => {
        if (!clientRef.current || !isConnected) return
        const targetTopic = resolveTopic(topic, deviceId)
        clientRef.current.publish(targetTopic, JSON.stringify(payload))
        console.log(`[MQTT WebUI] Immediate Publish -> [${targetTopic}]:`, payload)
    }, [isConnected, deviceId])

    const publishAi = useCallback(payload => {
        if (!clientRef.current || !isConnected) return
        const topic = `hexapod/${deviceId}/ai`
        clientRef.current.publish(topic, JSON.stringify(payload))
        console.log(`[MQTT WebUI] AI Publish -> [${topic}]:`, payload)
    }, [isConnected, deviceId])

    const publishAudio = useCallback(payload => {
        if (!clientRef.current || !isConnected) return
        const topic = `hexapod/${deviceId}/audio`
        clientRef.current.publish(topic, JSON.stringify(payload))
        console.log(`[MQTT WebUI] Audio Publish -> [${topic}]:`, payload)
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
        clearAiMessages 
    }
}