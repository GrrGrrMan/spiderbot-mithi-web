// web-ui/src/App.js
import React, { useState, useEffect, useCallback, useRef } from "react"
import { BrowserRouter as Router } from "react-router-dom"
import { DEFAULT_POSE } from "./templates"
import { SECTION_NAMES } from "./components/vars"
import { Nav, NavDetailed, DimensionsWidget } from "./components"
import { updateHexapod, Page } from "./AppHelpers"
import HexapodPlot from "./components/HexapodPlot"
import { useMqtt } from "./hooks/useMqtt"
import { useAiMotionExecutor } from "./hooks/useAiMotionExecutor"
import { useAiChat } from "./hooks/useAiChat"
import ViewportToggle from "./components/viewport/ViewportToggle"
import CameraView from "./components/camera/CameraView"
import DualStageViewport from "./components/camera/DualStageViewport"
import AiChatOverlay from "./components/ai/AiChatOverlay"
import { useContinuousWakeWord } from "./hooks/useContinuousWakeWord"
import { RobotProvider } from "./context/RobotContext"


function MainLayout() {
    const [inHexapodPage, setInHexapodPage] = useState(false)
    const [smartSpeaker, setSmartSpeaker] = useState(false)
    const [sentinelLog, setSentinelLog] = useState([])
    const lastProcessedMsgRef = useRef(null)
    const [hexapod, setHexapod] = useState(() => updateHexapod("default"))
    const [revision, setRevision] = useState(0)
    const [isAiOverlayOpen, setIsAiOverlayOpen] = useState(false)

    const activeExecutingActionRef = useRef(null)
    const stopAllRef = useRef(null)

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
        memoryState,
        publishAi,
        publishAiConfig,
        publishAiMemory,
        publishAudio,
    } = useMqtt()

    const manageState = useCallback((updateType, newParam, options = {}) => {
        // If human manually tweaks a slider/joint, preempt automated AI animations
        if (!options?.fromStream && !options?.fromExecutor && activeExecutingActionRef.current && stopAllRef.current) {
            activeExecutingActionRef.current = null
            stopAllRef.current()
        }

        setHexapod(prevHexapod => {
            const nextHexapod = updateHexapod(updateType, newParam, prevHexapod)
            setRevision(prev => prev + 1)
            return nextHexapod
        })
    }, [])

    // Dimensions auto-sync from hardware config baseline
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
    }, [config, manageState])

    // ── Single Authoritative Motion Executor ──
    const { activeExecutingAction, triggerAction, stopAll } = useAiMotionExecutor({
        params: { dimensions: hexapod.dimensions, pose: hexapod.pose },
        publishImmediate,
        publishAudio,
        onUpdate: manageState,
    })

    activeExecutingActionRef.current = activeExecutingAction
    stopAllRef.current = stopAll

    // ── Single Authoritative AI Chat & Directive Engine ──
    const aiChat = useAiChat({
        aiMessages,
        aiStatus,
        memoryState,
        publishAi,
        publishAiConfig,
        publishAiMemory,
        triggerAction,
    })

    const sentinel = useContinuousWakeWord({
        publishAi,
        aiOnline: aiChat.aiOnline,
        audioStatus,
        enabled: smartSpeaker,
    })

    useEffect(() => {
        if (!aiMessages || !aiMessages.length) return
        const lastMsg = aiMessages[aiMessages.length - 1]
        if (!lastMsg || lastMsg.type !== "sentinel_event") return

        const msgId = `${lastMsg.timestamp || ""}_${lastMsg.state}_${lastMsg.transcript || ""}`
        if (lastProcessedMsgRef.current === msgId) return
        lastProcessedMsgRef.current = msgId

        sentinel.handleSentinelEvent(lastMsg)

        if (lastMsg.command || lastMsg.transcript) {
            const entry = {
                id: Date.now(),
                time: new Date().toLocaleTimeString(),
                full: lastMsg.transcript || "",
                command: lastMsg.command || lastMsg.state || "",
            }
            setSentinelLog(prev => [entry, ...prev.slice(0, 20)])
        }
    }, [aiMessages, sentinel])

    // Directive routing is handled exclusively by useAiChat to prevent duplicate execution races


    // Hardware Watchdog Sync: Instantly stop UI animations if firmware applies emergency brakes
    const isWatchdogBraked = Boolean(telemetry?.watchdog_braked)
    useEffect(() => {
        if (isWatchdogBraked) {
            stopAll()
            window.dispatchEvent(new Event("hardware-watchdog-brake"))
        }
    }, [isWatchdogBraked, stopAll])

    const onPageLoad = useCallback(pageName => {
        document.title = pageName + " - Hexapod Robot Simulator"
        if (pageName === SECTION_NAMES.landingPage) {
            setInHexapodPage(false)
            return
        }
        setInHexapodPage(true)
        manageState("pose", { pose: DEFAULT_POSE })
    }, [manageState])

    const robotContextValue = React.useMemo(() => ({
        onMount: onPageLoad,
        onUpdate: manageState,
        publishThrottled,
        publishImmediate,
        publishAi,
        publishAiConfig,
        publishAiMemory,
        publishAudio,
        aiMessages,
        clearAiMessages,
        aiStatus,
        audioStatus,
        memoryState,
        isConnected,
        aiDeviceId: deviceId,
        camConfig,
        camTelemetry,
        hexapod,
        revision,
        params: {
            dimensions: hexapod.dimensions,
            pose: hexapod.pose,
        },
        activeExecutingAction,
        triggerAction,
        stopAll,
        aiChat,
        smartSpeaker,
        setSmartSpeaker,
        sentinel,
        sentinelLog,
        logs,
        clearLogs,
        telemetry,
    }), [
        onPageLoad, manageState, publishThrottled, publishImmediate, publishAi,
        publishAiConfig, publishAiMemory, publishAudio, aiMessages, clearAiMessages,
        aiStatus, audioStatus, memoryState, isConnected, deviceId, camConfig, camTelemetry,
        hexapod, revision, activeExecutingAction, triggerAction, stopAll, aiChat, smartSpeaker,
        sentinel, sentinelLog, logs, clearLogs, telemetry
    ])

    const pageComponent = useCallback(Component => <Component {...robotContextValue} />, [robotContextValue])

    return (
        <RobotProvider value={robotContextValue}>
            <Nav isConnected={isConnected} onToggleAi={() => setIsAiOverlayOpen(prev => !prev)} />

            <div id="main">
                <div id="sidebar" style={{ position: "relative" }}>
                    <AiChatOverlay
                        isOpen={isAiOverlayOpen}
                        onToggle={() => setIsAiOverlayOpen(prev => !prev)}
                        publishImmediate={publishImmediate}
                        publishAi={publishAi}
                        publishAiConfig={publishAiConfig}
                        publishAiMemory={publishAiMemory}
                        publishAudio={publishAudio}
                        aiMessages={aiMessages}
                        clearAiMessages={clearAiMessages}
                        aiStatus={aiStatus}
                        audioStatus={audioStatus}
                        memoryState={memoryState}
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
                        activeExecutingAction={activeExecutingAction}
                        triggerAction={triggerAction}
                        stopAll={stopAll}
                        aiChat={aiChat}
                        smartSpeaker={smartSpeaker}
                        setSmartSpeaker={setSmartSpeaker}
                        sentinel={sentinel}
                        sentinelLog={sentinelLog}
                    />

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

                   <div hidden={!inHexapodPage}>
                        <DimensionsWidget
                            params={{ dimensions: hexapod.dimensions }}
                            onUpdate={manageState}
                        />
                    </div>

                    <Page pageComponent={pageComponent} />
                    {!inHexapodPage ? <NavDetailed /> : null}
                </div>

                <div 
                    id="plot" 
                    className="border" 
                    style={{
                        position: "relative",
                        overflow: "hidden",
                        backgroundColor: "#0a0f1d",
                    }}
                    hidden={!inHexapodPage && activeView !== "cam" && activeView !== "dual"}
                >
                    <ViewportToggle activeView={activeView} onChange={setActiveView} />
                    
                    {activeView === "cam" ? (
                        <CameraView config={camConfig} telemetry={camTelemetry} isConnected={isConnected} />
                    ) : activeView === "dual" ? (
                        <DualStageViewport camConfig={camConfig} camTelemetry={camTelemetry} isConnected={isConnected} hexapod={hexapod} revision={revision} />
                    ) : (
                        <HexapodPlot revision={revision} hexapod={hexapod} />
                    )}
                </div>
            </div>

            {inHexapodPage ? <NavDetailed /> : null}
        </RobotProvider>
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