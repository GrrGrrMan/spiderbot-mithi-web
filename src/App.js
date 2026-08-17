// web-ui/src/App.js
import React, { useState, useEffect } from "react"
import { BrowserRouter as Router } from "react-router-dom"
import { DEFAULT_POSE } from "./templates"
import { SECTION_NAMES } from "./components/vars"
import { Nav, NavDetailed, DimensionsWidget, ConsoleDrawer } from "./components"
import { updateHexapod, Page } from "./AppHelpers"
import HexapodPlot from "./components/HexapodPlot"
import { useMqtt } from "./hooks/useMqtt"
import ViewportToggle from "./components/viewport/ViewportToggle"
import CameraView from "./components/camera/CameraView"

window.dataLayer = window.dataLayer || []
function gtag() {
    window.dataLayer.push(arguments)
}
function App() {
    const [inHexapodPage, setInHexapodPage] = useState(false)
    const [hexapod, setHexapod] = useState(() => updateHexapod("default"))
    const [revision, setRevision] = useState(0)

    // P2 Phase B: stage viewport mode. The camera is a stage-swap inside
    // #plot, NOT a nav page (see docs/future-roadmap/camera/README.md §B).
    // Deep-link via ?view=camera so /camera (redirected from AppHelpers)
    // lands the user in CAM mode without an extra click.
    const [activeView, setActiveView] = useState(() => {
        if (typeof window === "undefined") return "sim"
        const params = new URLSearchParams(window.location.search)
        return params.get("view") === "camera" ? "cam" : "sim"
    })

    // When the user flips back from CAM to SIM, force Plotly to recompute
    // its container dimensions. Without this the canvas stays at the
    // pre-swap size (the common React-Plotly "left over" bug).
    useEffect(() => {
        if (activeView === "sim") {
            // requestAnimationFrame defers until the DOM has swapped in the
            // HexapodPlot node; the resize event then triggers Plotly's
            // relayout pass.
            const id = requestAnimationFrame(() => {
                window.dispatchEvent(new Event("resize"))
            })
            return () => cancelAnimationFrame(id)
        }
        return undefined
    }, [activeView])

    const { isConnected, telemetry, logs, config, deviceId, publishThrottled, publishImmediate, clearLogs, aiMessages, aiStatus, audioStatus, publishAi, publishAudio } = useMqtt()

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

        // Only trigger a state update if dimensions differ from active hexapod model
        const curDims = hexapod.dimensions
        const hasChanged = Object.keys(translatedDimensions).some(
            key => translatedDimensions[key] !== curDims[key]
        )

        if (hasChanged) {
            manageState("dimensions", { dimensions: translatedDimensions })
            console.log("[MQTT WebUI] Auto-scaled 3D model from device config:", translatedDimensions)
        }
    }, [config, hexapod.dimensions])

    const onPageLoad = pageName => {
        document.title = pageName + " - Mithi's Bare Minimum Hexapod Robot Simulator"
        gtag("config", "UA-170794768-1", {
            page_path: window.location.pathname + window.location.search,
        })

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
            aiStatus={aiStatus}
            audioStatus={audioStatus}
            isConnected={isConnected}
            aiDeviceId={deviceId}
            params={{
                dimensions: hexapod.dimensions,
                pose: hexapod.pose,
            }}
        />
    )

    return (
        <Router>
            <Nav isConnected={isConnected} />
            <div id="main">
                <div id="sidebar">
                    {/* Live connection & telemetry HUD widget */}
                    <div className="border" style={{ marginBottom: "15px", padding: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: "bold" }}>ROBOT STATUS:</span>
                            <span 
                                style={{ 
                                    fontSize: "0.75rem", 
                                    color: isConnected ? "var(--c1-green)" : "var(--c6-red)",
                                    fontWeight: "bolder"
                                }}
                            >
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
                    <div hidden={!inHexapodPage}>
                        <DimensionsWidget
                            params={{ dimensions: hexapod.dimensions }}
                            onUpdate={manageState}
                        />
                    </div>
                    <Page pageComponent={pageComponent} />
                    {!inHexapodPage ? <NavDetailed /> : null}
                </div>
                <div id="plot" className="border" hidden={!inHexapodPage}>
                    {inHexapodPage && (
                        <ViewportToggle
                            activeView={activeView}
                            onChange={setActiveView}
                        />
                    )}
                    {activeView === "cam" ? (
                        <CameraView
                            config={config}
                            telemetry={telemetry}
                            isConnected={isConnected}
                        />
                    ) : (
                        <HexapodPlot
                            revision={revision}
                            hexapod={hexapod}
                        />
                    )}
                </div>
            </div>

            {/* Place Console Drawer directly below the split viewport container */}
            <ConsoleDrawer 
                telemetry={telemetry}
                isConnected={isConnected} 
                logs={logs} 
                publishImmediate={publishImmediate} 
                clearLogs={clearLogs}
            />

            {inHexapodPage ? <NavDetailed /> : null}
        </Router>
    )
}

export default App