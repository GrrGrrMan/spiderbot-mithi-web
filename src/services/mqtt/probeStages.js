// src/services/mqtt/probeStages.js

export const PROBE_STATUS = Object.freeze({
    IDLE: "idle",
    RUNNING: "running",
    SUCCESS: "success",
    ERROR: "error",
    SKIPPED: "skipped",
})

export const PROBE_STAGES = Object.freeze({
    SYNTAX: "syntax",
    SECURITY: "security",
    TRANSPORT: "transport",
    AUTH: "auth",
    PING: "ping",
    TELEMETRY: "telemetry",
})

export const PROBE_STAGE_METADATA = Object.freeze({
    [PROBE_STAGES.SYNTAX]: {
        label: "URI & Protocol Syntax",
        description: "Validates ws:// or wss:// format, host, and port range.",
    },
    [PROBE_STAGES.SECURITY]: {
        label: "Mixed-Content Policy",
        description: "Ensures HTTPS pages do not attempt insecure ws:// connections.",
    },
    [PROBE_STAGES.TRANSPORT]: {
        label: "WebSocket Handshake",
        description: "Establishes raw TCP/WebSocket connection to the broker.",
    },
    [PROBE_STAGES.AUTH]: {
        label: "MQTT Protocol & Auth",
        description: "Verifies broker CONNACK return code and access permissions.",
    },
    [PROBE_STAGES.PING]: {
        label: "Round-Trip Latency (RTT)",
        description: "Publishes and echoes a loopback packet to measure ping.",
    },
    [PROBE_STAGES.TELEMETRY]: {
        label: "Telemetry Beacon Check",
        description: "Listens for physical robot heartbeats on the device topic.",
    },
})

/**
 * Normalizes broker URL string, appending default protocol or port if omitted.
 */
export function normalizeBrokerUrl(input) {
    if (!input || typeof input !== "string") return ""
    let trimmed = input.trim()

    if (!trimmed.startsWith("ws://") && !trimmed.startsWith("wss://")) {
        const isHttps = typeof window !== "undefined" && window.location.protocol === "https:"
        trimmed = `${isHttps ? "wss" : "ws"}://${trimmed}`
    }

    return trimmed
}

/**
 * Validates if the string is a well-formed WebSocket URL.
 */
export function isValidWsUrl(url) {
    if (!url) return false
    const wsRegex = /^(ws|wss):\/\/([a-zA-Z0-9._-]+)(:(\d+))?(\/.*)?$/
    return wsRegex.test(url)
}