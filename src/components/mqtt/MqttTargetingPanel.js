// src/components/mqtt/MqttTargetingPanel.js
import React, { useState } from "react"
import {
    FaEye,
    FaEyeSlash,
    FaPlay,
    FaCheck,
    FaRedo,
    FaExclamationTriangle,
    FaLock,
    FaDownload,
    FaUpload,
} from "react-icons/fa"
import { MqttProfileSelector } from "./MqttProfileSelector"
import { MqttDiagnosticsView } from "./MqttDiagnosticsView"
import { mqttProbe } from "../../services/mqtt"
import { PROBE_STATUS } from "../../services/mqtt/probeStages"
import { settingsStorage } from "../../services/storage"

export const MqttTargetingPanel = ({
    activeConfig,
    connectToBroker,
    disconnect,
    reconnect,
    isConnected,
    isConnecting,
    connectionError,
    latencyRtt,
}) => {
    const [draft, setDraft] = useState(() => ({
        activePresetId: activeConfig.activePresetId || "custom",
        brokerUrl: activeConfig.brokerUrl || "ws://spider-w.local:9001",
        deviceId: activeConfig.deviceId || "hexapod-s3-01",
        camDeviceId: activeConfig.camDeviceId || "hexapod-cam-01",
        topicPrefix: activeConfig.topicPrefix || "hexapod",
        customCameraUrl: activeConfig.customCameraUrl || "",
        username: activeConfig.username || "",
        password: activeConfig.password || "",
        rememberAuth: activeConfig.rememberAuth || false,
    }))

    const [showPassword, setShowPassword] = useState(false)
    const [isSecurityOpen, setIsSecurityOpen] = useState(Boolean(draft.username || draft.password))
    const [isProbing, setIsProbing] = useState(false)
    const [probeStages, setProbeStages] = useState({})
    const [probeSummary, setProbeSummary] = useState(null)
    const [showDiagnostics, setShowDiagnostics] = useState(false)
    const [statusBanner, setStatusBanner] = useState(null)

    const isCurrentPageHttps = typeof window !== "undefined" && window.location.protocol === "https:"
    const isMixedContentRisk = isCurrentPageHttps && draft.brokerUrl.startsWith("ws://")

    const handleSelectPreset = profile => {
        setDraft(prev => ({
            ...prev,
            activePresetId: profile.id,
            ...profile.config,
        }))
    }

    const handleRunProbe = async () => {
        setIsProbing(true)
        setShowDiagnostics(true)
        setProbeStages({})
        setProbeSummary(null)

        const summary = await mqttProbe.runProbe(draft, event => {
            setProbeStages(prev => ({
                ...prev,
                [event.stage]: { status: event.status, message: event.message, ...event },
            }))
        })

        setIsProbing(false)
        setProbeSummary(summary)
    }

    const handleApplyAndConnect = () => {
        connectToBroker(draft)
        setStatusBanner("Parameters applied! Reconnecting...")
        setTimeout(() => setStatusBanner(null), 3000)
    }

    const handleExportBackup = () => {
        const json = settingsStorage.exportBackup()
        const blob = new Blob([json], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `hexapod-settings-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleImportBackup = e => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = ev => {
            const res = settingsStorage.importBackup(ev.target.result)
            if (res.success) {
                setStatusBanner("Settings restored successfully!")
                setTimeout(() => setStatusBanner(null), 2500)
            } else {
                alert(`Import failed: ${res.error}`)
            }
        }
        reader.readAsText(file)
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* Live Connection HUD */}
            <div style={hudBoxStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            backgroundColor: isConnected
                                ? "var(--c1-green)"
                                : isConnecting
                                ? "var(--c3-yellow, #ffd700)"
                                : "var(--c6-red)",
                            boxShadow: isConnected
                                ? "0 0 8px var(--c1-green)"
                                : isConnecting
                                ? "0 0 8px #ffd700"
                                : "0 0 8px var(--c6-red)",
                        }}
                    />
                    <span style={{ fontSize: "0.72rem", fontWeight: "bold", color: "#f8fafc" }}>
                        {isConnected ? "CONNECTED" : isConnecting ? "CONNECTING..." : "DISCONNECTED"}
                    </span>
                    {latencyRtt !== null && isConnected && (
                        <span style={latencyBadgeStyle}>{latencyRtt} ms RTT</span>
                    )}
                </div>

                <div style={{ display: "flex", gap: "4px" }}>
                    {isConnected ? (
                        <button type="button" onClick={disconnect} style={hudBtnStyle}>
                            Disconnect
                        </button>
                    ) : (
                        <button type="button" onClick={reconnect} style={hudBtnStyle}>
                            <FaRedo /> Reconnect
                        </button>
                    )}
                </div>
            </div>

            {statusBanner && <div style={bannerStyle}>{statusBanner}</div>}
            {connectionError && (
                <div style={errorCalloutStyle}>
                    <FaExclamationTriangle style={{ flexShrink: 0 }} />
                    <span>Error: {connectionError}</span>
                </div>
            )}

            {/* Mixed-Content Advisory for HTTPS / GitHub Pages */}
            {isMixedContentRisk && (
                <div style={warningCalloutStyle}>
                    <FaLock style={{ flexShrink: 0, marginTop: "2px" }} />
                    <div>
                        <strong>HTTPS Mixed-Content Warning:</strong>
                        <p style={{ margin: 0, fontSize: "0.6rem" }}>
                            This app is loaded over HTTPS. Web browsers block unencrypted <code>ws://</code> sockets.
                            Please use a <code>wss://</code> endpoint or secure tunnel.
                        </p>
                    </div>
                </div>
            )}

            {/* Quick Profiles Selector */}
            <MqttProfileSelector
                activePresetId={draft.activePresetId}
                onSelectPreset={handleSelectPreset}
            />

            {/* Broker Endpoint Form */}
            <div>
                <span style={labelStyle}>BROKER WEBSOCKET ENDPOINT:</span>
                <input
                    type="text"
                    value={draft.brokerUrl}
                    onChange={e => setDraft({ ...draft, brokerUrl: e.target.value, activePresetId: "custom" })}
                    placeholder="e.g. wss://broker.emqx.io:8084/mqtt or ws://spider-w.local:9001"
                    style={inputStyle}
                />
            </div>

            {/* Topology & Device IDs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div>
                    <span style={labelStyle}>ROBOT DEVICE ID:</span>
                    <input
                        type="text"
                        value={draft.deviceId}
                        onChange={e => setDraft({ ...draft, deviceId: e.target.value })}
                        style={inputStyle}
                    />
                </div>
                <div>
                    <span style={labelStyle}>CAMERA DEVICE ID:</span>
                    <input
                        type="text"
                        value={draft.camDeviceId}
                        onChange={e => setDraft({ ...draft, camDeviceId: e.target.value })}
                        style={inputStyle}
                    />
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div>
                    <span style={labelStyle}>TOPIC PREFIX:</span>
                    <input
                        type="text"
                        value={draft.topicPrefix}
                        onChange={e => setDraft({ ...draft, topicPrefix: e.target.value })}
                        style={inputStyle}
                    />
                </div>
                <div>
                    <span style={labelStyle}>CAMERA URL OVERRIDE:</span>
                    <input
                        type="text"
                        value={draft.customCameraUrl}
                        onChange={e => setDraft({ ...draft, customCameraUrl: e.target.value })}
                        placeholder="/cam-stream"
                        style={inputStyle}
                    />
                </div>
            </div>

            {/* Security & Authentication Section */}
            <div>
                <button
                    type="button"
                    onClick={() => setIsSecurityOpen(prev => !prev)}
                    style={accordionHeaderBtnStyle}
                >
                    <span>🔒 CREDENTIALS & SECURITY {draft.username ? "(Active)" : "(Optional)"}</span>
                    <span>{isSecurityOpen ? "▲" : "▼"}</span>
                </button>

                {isSecurityOpen && (
                    <div style={securityBodyStyle}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                            <div>
                                <span style={labelStyle}>USERNAME:</span>
                                <input
                                    type="text"
                                    value={draft.username}
                                    onChange={e => setDraft({ ...draft, username: e.target.value })}
                                    style={inputStyle}
                                    placeholder="Optional"
                                />
                            </div>
                            <div>
                                <span style={labelStyle}>PASSWORD:</span>
                                <div style={{ position: "relative" }}>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={draft.password}
                                        onChange={e => setDraft({ ...draft, password: e.target.value })}
                                        style={{ ...inputStyle, paddingRight: "25px" }}
                                        placeholder="Optional"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(prev => !prev)}
                                        style={eyeBtnStyle}
                                    >
                                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", marginTop: "4px" }}>
                            <input
                                type="checkbox"
                                checked={draft.rememberAuth}
                                onChange={e => setDraft({ ...draft, rememberAuth: e.target.checked })}
                                style={{ width: "auto", margin: 0 }}
                            />
                            <span style={{ fontSize: "0.62rem", color: "#cbd5e1" }}>
                                Remember password across reloads (unchecking keeps password in RAM session only)
                            </span>
                        </label>
                    </div>
                )}
            </div>

            {/* Diagnostics View */}
            {showDiagnostics && (
                <MqttDiagnosticsView
                    stages={probeStages}
                    isRunning={isProbing}
                    summary={probeSummary}
                    onDismiss={() => setShowDiagnostics(false)}
                />
            )}

            {/* Action Bar */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "4px" }}>
                <button
                    type="button"
                    onClick={handleRunProbe}
                    disabled={isProbing || !draft.brokerUrl}
                    style={{ ...actionBtnStyle, backgroundColor: "rgba(41, 128, 185, 0.35)", borderColor: "var(--c4-blue)", color: "#38bdf8" }}
                >
                    <FaPlay style={{ fontSize: "0.55rem" }} /> {isProbing ? "Probing..." : "Test Connection"}
                </button>

                <button
                    type="button"
                    onClick={handleApplyAndConnect}
                    disabled={!draft.brokerUrl}
                    style={{ ...actionBtnStyle, backgroundColor: "rgba(50, 255, 126, 0.2)", borderColor: "var(--c1-green)", color: "var(--c1-green)" }}
                >
                    <FaCheck style={{ fontSize: "0.55rem" }} /> Apply & Connect
                </button>
            </div>

            {/* Configuration Backup & Restore */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(41, 128, 185, 0.25)", paddingTop: "6px", marginTop: "4px" }}>
                <div style={{ display: "flex", gap: "6px" }}>
                    <button type="button" onClick={handleExportBackup} style={toolBtnStyle} title="Export Settings JSON Backup">
                        <FaDownload /> Backup Config
                    </button>
                    <label style={toolBtnStyle} title="Import Settings JSON Backup">
                        <FaUpload /> Restore Config
                        <input type="file" accept=".json" onChange={handleImportBackup} style={{ display: "none" }} />
                    </label>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        if (window.confirm("Reset MQTT settings to factory defaults?")) {
                            settingsStorage.resetSlice("mqtt")
                            setDraft(settingsStorage.getSlice("mqtt"))
                        }
                    }}
                    style={{ ...toolBtnStyle, color: "var(--c6-red)", borderColor: "rgba(255, 33, 33, 0.4)" }}
                >
                    Reset MQTT
                </button>
            </div>
        </div>
    )
}

const labelStyle = { fontSize: "0.6rem", fontWeight: "bold", color: "#94a3b8", display: "block", marginBottom: "2px" }
const inputStyle = { width: "100%", padding: "4px 8px", borderRadius: "4px", backgroundColor: "rgba(0, 0, 0, 0.5)", border: "1px solid rgba(41, 128, 185, 0.4)", color: "#fff", fontSize: "0.68rem", height: "1.8rem", boxSizing: "border-box" }
const hudBoxStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", borderRadius: "6px", backgroundColor: "rgba(10, 15, 25, 0.6)", border: "1px solid rgba(41, 128, 185, 0.3)" }
const hudBtnStyle = { background: "rgba(23, 33, 43, 0.8)", border: "1px solid rgba(41, 128, 185, 0.5)", color: "#cbd5e1", borderRadius: "4px", padding: "2px 8px", fontSize: "0.62rem", cursor: "pointer" }
const latencyBadgeStyle = { fontSize: "0.6rem", padding: "1px 5px", borderRadius: "8px", backgroundColor: "rgba(50, 255, 126, 0.15)", color: "var(--c1-green)", fontWeight: "bold", fontFamily: "monospace" }
const bannerStyle = { padding: "4px 8px", borderRadius: "4px", backgroundColor: "rgba(50, 255, 126, 0.2)", border: "1px solid var(--c1-green)", color: "var(--c1-green)", fontSize: "0.65rem", textAlign: "center" }
const errorCalloutStyle = { display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", borderRadius: "4px", backgroundColor: "rgba(255, 33, 33, 0.15)", border: "1px solid var(--c6-red)", color: "#fca5a5", fontSize: "0.62rem" }
const warningCalloutStyle = { display: "flex", alignItems: "flex-start", gap: "6px", padding: "6px 8px", borderRadius: "4px", backgroundColor: "rgba(255, 121, 63, 0.15)", border: "1px solid var(--c3-orange)", color: "#fdba74", fontSize: "0.64rem" }
const accordionHeaderBtnStyle = { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(41, 128, 185, 0.3)", borderRadius: "4px", color: "#cbd5e1", fontSize: "0.64rem", fontWeight: "bold", cursor: "pointer" }
const securityBodyStyle = { padding: "6px", backgroundColor: "rgba(0, 0, 0, 0.3)", border: "1px solid rgba(41, 128, 185, 0.25)", borderTop: "none", borderRadius: "0 0 4px 4px" }
const eyeBtnStyle = { position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "0.7rem", padding: 0 }
const actionBtnStyle = { display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "6px", borderRadius: "5px", border: "1px solid", fontSize: "0.68rem", fontWeight: "bold", cursor: "pointer" }
const toolBtnStyle = { display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 6px", borderRadius: "4px", backgroundColor: "rgba(23, 33, 43, 0.8)", border: "1px solid rgba(41, 128, 185, 0.4)", color: "#cbd5e1", fontSize: "0.6rem", cursor: "pointer" }

export default MqttTargetingPanel