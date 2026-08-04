// web-ui/src/hooks/useMqtt.js
import { useState, useEffect, useCallback, useRef } from "react"
import mqtt from "mqtt"

const getBrokerUrl = () => {
    const params = new URLSearchParams(window.location.search)
    const queryBroker = params.get("broker")
    
    // 1. Manual override via URL (e.g., http://localhost:3000/?broker=pi-hub.local)
    if (queryBroker) {
        return `ws://${queryBroker}:9001`
    }
    
    const hostname = window.location.hostname
    
    // 2. Development Mode: Fallback to the EMQX cloud broker for Wokwi testing
    if (hostname === "localhost" || hostname === "127.0.0.1") {
        return "ws://broker.emqx.io:8083/mqtt"
    }
    
    // 3. Production Mode: Auto-resolve to RPi's active address (192.168.4.1 or pi-hub.local)
    return `ws://${hostname}:9001`
}

const resolveTopic = (topic, deviceId) => {
    if (!topic || topic === "hexapod/cmd") {
        return `hexapod/${deviceId}/cmd`
    }
    return topic
}

export function useMqtt(brokerUrlOverride = null, deviceId = "hexapod-cam-01") {
    const [isConnected, setIsConnected] = useState(false)
    const [telemetry, setTelemetry] = useState(null)
    const [logs, setLogs] = useState([])
    const [config, setConfig] = useState(null)
    const clientRef = useRef(null)
    const lastPublishRef = useRef(0)

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
            console.log(`[MQTT WebUI] Connected and subscribed to topics for device: ${deviceId}`)
        })

        client.on("close", () => {
            setIsConnected(false)
        })

        client.on("message", (topic, message) => {
            const payload = message.toString()
            
            if (topic.endsWith("telemetry")) {
                try {
                    setTelemetry(JSON.parse(payload))
                } catch (e) {
                    console.error("[MQTT WebUI] Telemetry parse error:", e)
                }
            } else if (topic.endsWith("config")) {
                try {
                    setConfig(JSON.parse(payload))
                    console.log("[MQTT WebUI] Configuration handshake received:", payload)
                } catch (e) {
                    console.error("[MQTT WebUI] Config parse error:", e)
                }
            } else if (topic.endsWith("logs")) {
                setLogs(prev => [...prev.slice(-99), payload])
            }
        })

        clientRef.current = client

        return () => {
            if (client) {
                client.end()
            }
        }
    }, [brokerUrlOverride, deviceId])

    useEffect(() => {
        if (!isConnected || !clientRef.current) return

        // Periodically publishes a lightweight heartbeat to reset the ESP32 safety watchdog
        const heartbeatInterval = setInterval(() => {
            const targetTopic = `hexapod/${deviceId}/cmd`
            const payload = JSON.stringify({ type: "heartbeat" })
            
            try {
                clientRef.current.publish(targetTopic, payload)
            } catch (err) {
                console.error("[MQTT WebUI] Heartbeat publish failed:", err)
            }
        }, 500) // 500ms intervals (twice as fast as the 1000ms watchdog timeout)

        return () => {
            clearInterval(heartbeatInterval)
        }
    }, [isConnected, deviceId])

    const publishThrottled = useCallback((topic, payload) => {
        if (!clientRef.current || !isConnected) return
        const targetTopic = resolveTopic(topic, deviceId)
        const now = Date.now()
        if (now - lastPublishRef.current >= 100) { // 100ms = 10Hz
            clientRef.current.publish(targetTopic, JSON.stringify(payload))
            lastPublishRef.current = now
            console.log(`[MQTT WebUI] Throttled Publish -> [${targetTopic}]:`, payload)
        }
    }, [isConnected, deviceId])

    const publishImmediate = useCallback((topic, payload) => {
        if (!clientRef.current || !isConnected) return
        const targetTopic = resolveTopic(topic, deviceId)
        clientRef.current.publish(targetTopic, JSON.stringify(payload))
        console.log(`[MQTT WebUI] Immediate Publish -> [${targetTopic}]:`, payload)
    }, [isConnected, deviceId])

    return { isConnected, telemetry, logs, config, publishThrottled, publishImmediate }
}