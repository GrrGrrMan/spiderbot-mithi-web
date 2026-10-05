// src/services/mqtt/MqttProbeService.js
import mqtt from "mqtt"
import {
    PROBE_STATUS,
    PROBE_STAGES,
    isValidWsUrl,
    normalizeBrokerUrl,
} from "./probeStages"

export class MqttProbeService {
    constructor() {
        this.activeClient = null
        this.isProbeRunning = false
    }

    /**
     * Executes an isolated, non-destructive probe against the given target configuration.
     *
     * @param {object} config - Target broker and device parameters
     * @param {function} onProgress - Callback receiving stage progress events
     * @returns {Promise<object>} Final summary with RTT latency and telemetry status
     */
    async runProbe(config, onProgress = () => {}) {
        if (this.isProbeRunning) {
            this.abort()
        }

        this.isProbeRunning = true
        const normalizedUrl = normalizeBrokerUrl(config.brokerUrl)
        const topicPrefix = config.topicPrefix || "hexapod"
        const deviceId = config.deviceId || "hexapod-s3-01"
        const probeId = `probe-${Math.random().toString(16).substr(2, 6)}`
        const probeTopic = `${topicPrefix}/diagnostics/probe/${probeId}`
        const telemetryTopic = `${topicPrefix}/${deviceId}/telemetry`

        const report = (stage, status, message, meta = {}) => {
            onProgress({ stage, status, message, ...meta })
        }

        // ── Phase 1: Syntactic URI Validation ──
        report(PROBE_STAGES.SYNTAX, PROBE_STATUS.RUNNING, "Validating URI syntax...")
        if (!isValidWsUrl(normalizedUrl)) {
            report(
                PROBE_STAGES.SYNTAX,
                PROBE_STATUS.ERROR,
                `Invalid WebSocket URL: "${normalizedUrl}". Must start with ws:// or wss://`
            )
            this.isProbeRunning = false
            return { success: false, failedStage: PROBE_STAGES.SYNTAX }
        }
        report(PROBE_STAGES.SYNTAX, PROBE_STATUS.SUCCESS, `Valid endpoint: ${normalizedUrl}`)

        // ── Phase 2: Mixed-Content Security Check ──
        report(PROBE_STAGES.SECURITY, PROBE_STATUS.RUNNING, "Evaluating browser security policy...")
        const isCurrentPageHttps = typeof window !== "undefined" && window.location.protocol === "https:"
        if (isCurrentPageHttps && normalizedUrl.startsWith("ws://")) {
            const errDetail =
                "Blocked by Browser Mixed-Content Policy: This page is served over HTTPS and cannot open unencrypted ws:// sockets. Use wss:// or a secure proxy."
            report(PROBE_STAGES.SECURITY, PROBE_STATUS.ERROR, errDetail)
            this.isProbeRunning = false
            return { success: false, failedStage: PROBE_STAGES.SECURITY, error: errDetail }
        }
        report(
            PROBE_STAGES.SECURITY,
            PROBE_STATUS.SUCCESS,
            normalizedUrl.startsWith("wss://") ? "TLS encrypted WSS transport confirmed." : "Standard WS transport permitted."
        )

        // ── Phase 3 & 4: Transport & Protocol Auth Handshake ──
        report(PROBE_STAGES.TRANSPORT, PROBE_STATUS.RUNNING, "Initiating WebSocket handshake...")
        report(PROBE_STAGES.AUTH, PROBE_STATUS.IDLE, "Awaiting CONNACK packet...")

        let client = null
        let rttMs = null
        let hasActiveTelemetry = false

        try {
            await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error("Connection timed out after 5000ms. Check host and port."))
                }, 5000)

                const clientOptions = {
                    clientId: `probe-${Math.random().toString(16).substr(2, 8)}`,
                    clean: true,
                    connectTimeout: 4500,
                    reconnectPeriod: 0, // Zero reconnect: probe fails fast on error
                }

                if (config.username) clientOptions.username = config.username
                if (config.password) clientOptions.password = config.password

                client = mqtt.connect(normalizedUrl, clientOptions)
                this.activeClient = client

                client.on("connect", () => {
                    clearTimeout(timeoutId)
                    report(PROBE_STAGES.TRANSPORT, PROBE_STATUS.SUCCESS, "WebSocket connection established.")
                    report(PROBE_STAGES.AUTH, PROBE_STATUS.SUCCESS, "MQTT CONNACK accepted (Authorized).")
                    resolve()
                })

                client.on("error", err => {
                    clearTimeout(timeoutId)
                    reject(err)
                })

                client.on("close", () => {
                    clearTimeout(timeoutId)
                    reject(new Error("Socket closed unexpectedly during handshake."))
                })
            })
        } catch (err) {
            report(PROBE_STAGES.TRANSPORT, PROBE_STATUS.ERROR, `Connection failed: ${err.message}`)
            report(PROBE_STAGES.AUTH, PROBE_STATUS.SKIPPED, "Authentication skipped due to socket failure.")
            this.abort()
            return { success: false, failedStage: PROBE_STAGES.TRANSPORT, error: err.message }
        }

        // ── Phase 5: Bidirectional Latency (RTT) Loopback Ping ──
        report(PROBE_STAGES.PING, PROBE_STATUS.RUNNING, "Measuring round-trip latency (RTT)...")
        try {
            rttMs = await new Promise((resolve, reject) => {
                const pingTimeout = setTimeout(() => {
                    reject(new Error("RTT ping timeout: Broker failed to echo packet in 3000ms."))
                }, 3000)

                const sendTime = Date.now()

                client.subscribe(probeTopic, err => {
                    if (err) {
                        clearTimeout(pingTimeout)
                        reject(err)
                        return
                    }
                    client.publish(probeTopic, JSON.stringify({ ping: sendTime }))
                })

                client.on("message", (topic, payload) => {
                    if (topic === probeTopic) {
                        clearTimeout(pingTimeout)
                        const latency = Date.now() - sendTime
                        resolve(latency)
                    }
                })
            })
            report(PROBE_STAGES.PING, PROBE_STATUS.SUCCESS, `Round-trip latency: ${rttMs} ms`, { rttMs })
        } catch (err) {
            report(PROBE_STAGES.PING, PROBE_STATUS.ERROR, `Ping measurement failed: ${err.message}`)
        }

        // ── Phase 6: Robot Telemetry Beacon Check ──
        report(PROBE_STAGES.TELEMETRY, PROBE_STATUS.RUNNING, `Listening for robot beacon on "${telemetryTopic}"...`)
        try {
            hasActiveTelemetry = await new Promise(resolve => {
                const telemetryWait = setTimeout(() => {
                    resolve(false) // Robot didn't publish, but probe overall succeeded
                }, 2000)

                client.subscribe(telemetryTopic, () => {})

                client.on("message", topic => {
                    if (topic === telemetryTopic) {
                        clearTimeout(telemetryWait)
                        resolve(true)
                    }
                })
            })

            if (hasActiveTelemetry) {
                report(
                    PROBE_STAGES.TELEMETRY,
                    PROBE_STATUS.SUCCESS,
                    `Active robot telemetry detected from "${deviceId}".`
                )
            } else {
                report(
                    PROBE_STAGES.TELEMETRY,
                    PROBE_STATUS.SUCCESS,
                    `Broker connected, but no telemetry seen on "${deviceId}" (robot may be offline).`
                )
            }
        } catch (err) {
            report(PROBE_STAGES.TELEMETRY, PROBE_STATUS.ERROR, `Telemetry listener error: ${err.message}`)
        }

        this.abort()
        return {
            success: true,
            rttMs,
            hasActiveTelemetry,
            normalizedUrl,
        }
    }

    /**
     * Terminates any in-flight test socket immediately.
     */
    abort() {
        if (this.activeClient) {
            try {
                this.activeClient.end(true)
            } catch (_) {}
            this.activeClient = null
        }
        this.isProbeRunning = false
    }
}

export const mqttProbe = new MqttProbeService()
export default mqttProbe