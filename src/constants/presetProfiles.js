// src/constants/presetProfiles.js

/**
 * Predefined network target profiles for standard robotics deployments.
 */
export const PRESET_PROFILES = Object.freeze([
    {
        id: "pi-mdns",
        name: "Pi mDNS (Local)",
        description: "Raspberry Pi via spider-w.local",
        badge: "DEV",
        config: {
            brokerUrl: "ws://spider-w.local:9001",
            deviceId: "hexapod-s3-01",
            camDeviceId: "hexapod-cam-01",
            topicPrefix: "hexapod",
            customCameraUrl: "/cam-stream",
            username: "",
            password: "",
        },
    },
    {
        id: "pi-hotspot",
        name: "AP Hotspot",
        description: "Direct connection via 192.168.4.1",
        badge: "FIELD",
        config: {
            brokerUrl: "ws://192.168.4.1:9001",
            deviceId: "hexapod-s3-01",
            camDeviceId: "hexapod-cam-01",
            topicPrefix: "hexapod",
            customCameraUrl: "http://192.168.4.1/cam-stream",
            username: "",
            password: "",
        },
    },
    {
        id: "secure-proxy",
        name: "Reverse Proxy (WSS)",
        description: "Secure proxy on port 443 /mqtt",
        badge: "HTTPS",
        config: {
            brokerUrl:
                typeof window !== "undefined"
                    ? `wss://${window.location.host}/mqtt`
                    : "wss://spider-w.local/mqtt",
            deviceId: "hexapod-s3-01",
            camDeviceId: "hexapod-cam-01",
            topicPrefix: "hexapod",
            customCameraUrl: "/cam-stream",
            username: "",
            password: "",
        },
    },
    {
        id: "emqx-cloud",
        name: "EMQX Public Cloud",
        description: "Free public secure sandbox broker",
        badge: "CLOUD",
        config: {
            brokerUrl: "wss://broker.emqx.io:8084/mqtt",
            deviceId: "hexapod-s3-01",
            camDeviceId: "hexapod-cam-01",
            topicPrefix: "hexapod/sandbox",
            customCameraUrl: "",
            username: "",
            password: "",
        },
    },
    {
        id: "hivemq-cloud",
        name: "HiveMQ Public WSS",
        description: "Public TLS WebSocket broker",
        badge: "CLOUD",
        config: {
            brokerUrl: "wss://broker.hivemq.com:8884/mqtt",
            deviceId: "hexapod-s3-01",
            camDeviceId: "hexapod-cam-01",
            topicPrefix: "hexapod/sandbox",
            customCameraUrl: "",
            username: "",
            password: "",
        },
    },
    {
        id: "custom",
        name: "Custom Target",
        description: "Self-hosted private broker",
        badge: "CUSTOM",
        config: {
            brokerUrl: "",
            deviceId: "hexapod-s3-01",
            camDeviceId: "hexapod-cam-01",
            topicPrefix: "hexapod",
            customCameraUrl: "",
            username: "",
            password: "",
        },
    },
])

export default PRESET_PROFILES