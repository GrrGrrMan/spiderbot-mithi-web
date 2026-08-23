// web-ui/src/App.js
import React, { useState, useEffect } from "react"
import { BrowserRouter as Router, useLocation } from "react-router-dom"
import { DEFAULT_POSE } from "./templates"
import { SECTION_NAMES } from "./components/vars"
import { Nav, NavDetailed, DimensionsWidget } from "./components"
import { updateHexapod, Page } from "./AppHelpers"
import HexapodPlot from "./components/HexapodPlot"
import { useMqtt } from "./hooks/useMqtt"
import ViewportToggle from "./components/viewport/ViewportToggle"
import CameraView from "./components/camera/CameraView"
import AiChatOverlay from "./components/ai/AiChatOverlay"

function MainLayout() {
    const location = useLocation()
    const isJudgementView = location.pathname === "/judgement"

    const [inHexapodPage, setInHexapodPage] = useState(false)
    const [hexapod, setHexapod] = useState(() => updateHexapod("default"))
    const [revision, setRevision] = useState(0)
    const [isAiOverlayOpen, setIsAiOverlayOpen] = useState(false) // ◄ Overlay toggle

    const [activeView, setActiveView] = useState(() => {
        if (typeof window === "undefined") return "sim"
        const params = new URLSearchParams(window.location.search)
        return params.get("view") === "camera" ? "cam" : "sim"
    })

    const {
        isConnected,
        telemetry,
        logs,
        config,
        deviceId,
        camTelemetry,
        camConfig,
        publishThrottled,
        publishImmediate,
        clearLogs,
        clearAiMessages,
        aiMessages,
        aiStatus,
        audioStatus,
        publishAi,
        publishAudio,
    } = useMqtt()

    // Dimensions auto-sync from hardware config
    useEffect(() => {
        if (!config || !config.dimensions) return
        const { coxia, femur, tibia, body_length, body_width_center, body_width_corner } = config.dimensions
        const translatedDimensions = {
            front: Math.round(body_width_corner / 2.0),
            side: parseFloat((body_length / 2.0).toFixed(1)),
            middle: Math.round(body_width_center / 2.0),
            coxia: Math.round(coxia),
            femur: Math.round(femur),
            tibia: Math.round(tibia),
        }
        manageState("dimensions", { dimensions: translatedDimensions })
    }, [config])

    const onPageLoad = pageName => {
        document.title = pageName + " - Hexapod Robot Simulator"
        if (pageName === SECTION_NAMES.landingPage) {
            setInHexapodPage(false)
            return
        }
        setInHexapodPage(true)
        manageState("pose", { pose: DEFAULT_POSE })
    }

    const manageState = (updateType, newParam) => {
        setHexapod(prevHexapod => {
            const nextHexapod = updateHexapod(updateType, newParam, prevHexapod)
            setRevision(prev => prev + 1)
            return nextHexapod
        })
    }

    const pageComponent = Component => (
        <Component
            onMount={onPageLoad}
            onUpdate={manageState}
            publishThrottled={publishThrottled}
            publishImmediate={publishImmediate}
            publishAi={publishAi}
            publishAudio={publishAudio}
            aiMessages={aiMessages}
            clearAiMessages={clearAiMessages}
            aiStatus={aiStatus}
            audioStatus={audioStatus}
            isConnected={isConnected}
            aiDeviceId={deviceId}
            camConfig={camConfig}
            camTelemetry={camTelemetry}
            hexapod={hexapod}
            revision={revision}
            params={{
                dimensions: hexapod.dimensions,
                pose: hexapod.pose,
            }}
        />
    )

    return (
        <>
            <Nav isConnected={isConnected} onToggleAi={() => setIsAiOverlayOpen(prev => !prev)} />

            <div id="main" style={isJudgementView ? { display: "block" } : undefined}>
                {/* ── Left Sidebar (relative positioning enables docked overlay) ── */}
                <div 
                    id="sidebar" 
                    style={{ 
                        position: "relative", 
                        ...(isJudgementView ? { width: "100%", maxWidth: "100%", margin: 0 } : {}) 
                    }}
                >
                    {/* Floating / Docked AI Overlay */}
                    <AiChatOverlay
                        isOpen={isAiOverlayOpen}
                        onToggle={() => setIsAiOverlayOpen(prev => !prev)}
                        publishImmediate={publishImmediate}
                        publishAi={publishAi}
                        publishAudio={publishAudio}
                        aiMessages={aiMessages}
                        clearAiMessages={clearAiMessages}
                        aiStatus={aiStatus}
                        audioStatus={audioStatus}
                        isConnected={isConnected}
                        aiDeviceId={deviceId}
                        logs={logs}                 
                        clearLogs={clearLogs}         
                        telemetry={telemetry}        
                        params={{
                            dimensions: hexapod.dimensions,
                            pose: hexapod.pose,
                        }}
                        onUpdate={manageState}
                    />

                    {/* Robot Status Box */}
                    <div className="border" style={{ marginBottom: "15px", padding: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: "bold" }}>ROBOT STATUS:</span>
                            <span style={{ fontSize: "0.75rem", color: isConnected ? "var(--c1-green)" : "var(--c6-red)", fontWeight: "bolder" }}>
                                {isConnected ? "CONNECTED" : "DISCONNECTED"}
                            </span>
                        </div>
                        {telemetry && (
                            <div style={{ marginTop: "8px", fontSize: "0.65rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                                <div>IP: {telemetry.ip || "N/A"}</div>
                                <div>RSSI: {telemetry.rssi ? `${telemetry.rssi} dBm` : "N/A"}</div>
                                <div>Heap: {telemetry.free_heap ? `${(telemetry.free_heap / 1024).toFixed(1)} KB` : "N/A"}</div>
                                <div>Uptime: {telemetry.uptime ? `${telemetry.uptime}s` : "N/A"}</div>
                            </div>
                        )}
                    </div>

                    <div hidden={!inHexapodPage || isJudgementView}>
                        <DimensionsWidget
                            params={{ dimensions: hexapod.dimensions }}
                            onUpdate={manageState}
                        />
                    </div>

                    <Page pageComponent={pageComponent} />
                    {!inHexapodPage ? <NavDetailed /> : null}
                </div>

                {/* ── Right Stage (3D Kinematics Simulator / Camera) ── */}
                <div 
                    id="plot" 
                    className="border" 
                    style={{
                        position: "relative",
                        overflow: "hidden",
                        backgroundColor: "#0a0f1d",
                    }}
                    hidden={(!inHexapodPage && activeView !== "cam") || isJudgementView}
                >
                    {(!isJudgementView) && (
                        <ViewportToggle activeView={activeView} onChange={setActiveView} />
                    )}
                    {activeView === "cam" ? (
                        <CameraView config={camConfig} telemetry={camTelemetry} isConnected={isConnected} />
                    ) : (
                        <HexapodPlot revision={revision} hexapod={hexapod} />
                    )}
                </div>
            </div>

            {inHexapodPage ? <NavDetailed /> : null}
        </>
    )
}

function App() {
    return (
        <Router>
            <MainLayout />
        </Router>
    )
}

export default App