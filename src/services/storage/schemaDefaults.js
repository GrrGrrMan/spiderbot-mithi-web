// src/services/storage/schemaDefaults.js

export const SCHEMA_VERSION = 1
export const STORAGE_KEY = "HEXAPOD_V2_CONFIG_V1"

/**
 * Canonical Single Source of Truth (SSOT) default configuration schema.
 */
export const DEFAULT_APP_SETTINGS = Object.freeze({
    _version: SCHEMA_VERSION,
    _updatedAt: 0,
    mqtt: {
        activePresetId: "pi-mdns",
        brokerUrl: "ws://spider-w.local:9001",
        username: "",
        password: "",
        rememberAuth: false,
        deviceId: "hexapod-s3-01",
        camDeviceId: "hexapod-cam-01",
        topicPrefix: "hexapod",
        customCameraUrl: "",
        clean: true,
        keepalive: 60,
        reconnectPeriod: 4000,
    },
    llm: {
        model: "hexapod-vision",
        visionModel: "hexapod-vision",
        thinkingLevel: "off",
        personality: "friendly",
        temperature: 0.3,
        customInstructions: "",
    },
    memory: {
        mode: "session", // "ephemeral" | "session" | "persistent"
        memoryPool: {},
    },
    ui: {
        modalPos: { x: 20, y: 75 },
        isMinimized: false,
        fabCorner: "bottom-left",
        activeView: "sim", // "sim" | "cam" | "dual"
        smartSpeaker: false,
        activeTab: "ai", // "ai" | "system" | "mqtt"
    },
    hardware: {
        customDimensions: null,
    },
})