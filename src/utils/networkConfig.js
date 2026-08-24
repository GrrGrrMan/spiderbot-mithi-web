// web-ui/src/utils/networkConfig.js

/**
 * Single Point of Truth (SSOT) for Network Discovery and Endpoint Resolution.
 * Resolves Pi-Hub location whether running in Local Dev (PC) or Production (Nginx on Pi).
 */

export const DEFAULT_PI_MDNS_HOST = "spider-w.local"
export const DEFAULT_HOTSPOT_GATEWAY = "192.168.4.1"
export const DEFAULT_MQTT_WS_PORT = 9001

export const isLocalhost = (hostname) => {
    return (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1"
    )
}

/**
 * Resolves the primary IP or Hostname of the Raspberry Pi.
 */
export const resolvePiHost = (searchParams) => {
    if (typeof window === "undefined") return DEFAULT_PI_MDNS_HOST

    // 1. Explicit query override: ?broker=192.168.1.150 or ?broker=spider-w.local
    const queryBroker = searchParams?.get("broker")
    if (queryBroker) return queryBroker

    const currentHost = window.location.hostname

    // 2. Development Mode on PC -> Default to mDNS hostname
    if (isLocalhost(currentHost)) {
        return DEFAULT_PI_MDNS_HOST
    }

    // 3. Production Mode -> Browser connects directly to current origin (Pi's IP/Host)
    return currentHost
}

/**
 * Resolves the WebSocket URL for the Mosquitto MQTT broker on the Pi.
 */
export const resolveMqttBrokerUrl = (searchParams) => {
    if (typeof window === "undefined") return `ws://${DEFAULT_PI_MDNS_HOST}:${DEFAULT_MQTT_WS_PORT}`

    // 1. Explicit query override
    const queryBroker = searchParams?.get("broker")
    if (queryBroker) {
        if (queryBroker.startsWith("ws://") || queryBroker.startsWith("wss://")) {
            return queryBroker
        }
        const isHttps = window.location.protocol === "https:"
        return `${isHttps ? "wss" : "ws"}://${queryBroker}${isHttps ? "/mqtt" : `:${DEFAULT_MQTT_WS_PORT}`}`
    }

    const isHttps = window.location.protocol === "https:"
    const currentHost = window.location.hostname

    // 2. Development Mode on PC -> Direct WebSocket to Pi's Mosquitto port 9001
    if (isLocalhost(currentHost)) {
        return `ws://${DEFAULT_PI_MDNS_HOST}:${DEFAULT_MQTT_WS_PORT}`
    }

    // 3. HTTPS Secure Context (Tailscale HTTPS) -> Route WSS through Nginx /mqtt on Port 443
    if (isHttps) {
        return `wss://${window.location.host}/mqtt`
    }

    // 4. Standard HTTP Production Mode -> Direct WS to port 9001
    return `ws://${currentHost}:${DEFAULT_MQTT_WS_PORT}`
}

/**
 * Resolves the MJPEG Camera Stream URL through the Pi's Nginx proxy (/cam-stream).
 */
export const resolveCameraStreamUrl = (config, telemetry, searchParams) => {
    // 1. Query override: ?mjpeg=http://192.168.1.50:81/stream
    const qOverride = searchParams?.get("mjpeg")
    if (qOverride) return qOverride

    if (typeof window === "undefined") return `http://${DEFAULT_PI_MDNS_HOST}/cam-stream`

    const currentHost = window.location.hostname

    // 2. Local Dev on PC -> Point to Pi's Nginx proxy via resolved Pi host
    if (isLocalhost(currentHost)) {
        const piHost = resolvePiHost(searchParams)
        return `http://${piHost}/cam-stream`
    }

    // 3. Production on Pi Nginx -> Use direct relative reverse proxy endpoint
    return `/cam-stream`
}