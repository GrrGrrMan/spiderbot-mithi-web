// web-ui/src/components/ai/AiChatOverlay.js
import React, { useState, useCallback } from "react"
import { FaRobot, FaTerminal } from "react-icons/fa"
import { useDraggableModal } from "../../hooks/useDraggableModal"
import { useCornerSnap } from "../../hooks/useCornerSnap"
import { HubFab } from "../hub/HubFab"
import { HubHeader } from "../hub/HubHeader"
import { HubAiView } from "../hub/HubAiView"
import { HubSystemView } from "../hub/HubSystemView"

const TAB_CONFIG = [
    { id: "ai", label: "AI Copilot & Gestures", icon: FaRobot, color: "var(--c1-green)" },
    { id: "system", label: "System Console & Logs", icon: FaTerminal, color: "var(--c4-blue)" },
]

export const AiChatOverlay = ({
    isOpen,
    onToggle,
    publishImmediate = () => {},
    publishAiMemory = () => {},
    memoryState = null,
    aiStatus = null,
    audioStatus = null,
    isConnected = false,
    clearAiMessages = () => {},
    logs = [],
    clearLogs = () => {},
    telemetry = null,
    aiChat,
    activeExecutingAction,
    stopAll,
    smartSpeaker,
    setSmartSpeaker,
    sentinel,
    sentinelLog,
}) => {
    const [activeTab, setActiveTab] = useState("ai")
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [localIsAwake, setLocalIsAwake] = useState(true)

    const isAwake = telemetry?.power !== undefined ? telemetry.power : localIsAwake
    const handlePowerToggle = useCallback(() => {
        const next = !isAwake
        setLocalIsAwake(next)
        publishImmediate("hexapod/cmd", { type: "system", power: next })
    }, [isAwake, publishImmediate])

    const {
        position,
        isDragging,
        isMinimized,
        setIsMinimized,
        cardRef,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handlePointerCancel,
    } = useDraggableModal(20, 75)

    const cornerSnap = useCornerSnap({
        boundary: "window",
        defaultCorner: "bottom-left",
        marginX: 20,
        marginY: 20,
        defaultWidth: 145,
        defaultHeight: 42,
    })

    const activeConfig = TAB_CONFIG.find(t => t.id === activeTab) || TAB_CONFIG[0]

    return (
        <>
            <HubFab 
                isOpen={isOpen} 
                onToggle={onToggle} 
                activeColor={activeConfig.color} 
                isExecuting={Boolean(activeExecutingAction)} 
                cornerSnap={cornerSnap} 
            />

            <div
                ref={cardRef}
                style={{
                    position: "fixed",
                    left: `${isOpen ? position.x : cornerSnap.pos.x}px`,
                    top: `${isOpen ? position.y : cornerSnap.pos.y}px`,
                    opacity: isOpen ? 1 : 0,
                    transform: isOpen ? "scale(1)" : "scale(0.4)",
                    pointerEvents: isOpen ? "auto" : "none",
                    visibility: isOpen ? "visible" : "hidden",
                    transformOrigin: "top left",
                        width: "440px",
                        maxWidth: "calc(100vw - 20px)",
                        maxHeight: "calc(100vh - 85px)",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        zIndex: 80,
                        backgroundColor: "rgba(15, 23, 42, 0.96)",
                        backdropFilter: "blur(14px)",
                        border: `1.5px solid ${isDragging ? "var(--c1-green)" : "var(--c4-blue)"}`,
                        borderRadius: "10px",
                        padding: "10px 12px",
                        boxShadow: isDragging
                            ? "0 18px 45px rgba(0, 0, 0, 0.85), 0 0 25px rgba(50, 255, 126, 0.35)"
                            : "0 12px 36px rgba(0, 0, 0, 0.75), 0 0 18px rgba(41, 128, 185, 0.3)",
                        userSelect: isDragging ? "none" : "auto",
                        touchAction: "none",
                        willChange: isDragging ? "left, top" : "auto",
                        // ── Instant 0ms response during drag; smooth OS-like transitions on release & toggle ──
                        transition: isDragging
                            ? "none"
                            : "left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease, visibility 0.2s, box-shadow 0.2s ease, border-color 0.2s ease",
                    }}
                    onClick={() => isMenuOpen && setIsMenuOpen(false)}
                >
                    <HubHeader
                        tabConfig={TAB_CONFIG}
                        activeTab={activeTab}
                        onSelectTab={setActiveTab}
                        isMenuOpen={isMenuOpen}
                        setIsMenuOpen={setIsMenuOpen}
                        isDragging={isDragging}
                        activeExecutingAction={activeExecutingAction}
                        onClear={() => {
                            if (activeTab === "ai") {
                                if (aiChat && aiChat.setMessages) {
                                    aiChat.setMessages([])
                                }
                                clearAiMessages()
                            } else {
                                clearLogs()
                            }
                        }}
                        isMinimized={isMinimized}
                        onToggleMinimize={() => setIsMinimized(prev => !prev)}
                        onClose={onToggle}
                        telemetry={telemetry}
                        isAwake={isAwake}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerCancel}
                    />

                    {!isMinimized && isOpen && (
                        <div className="no-drag" style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px", overflowY: "auto", flex: 1, paddingRight: "4px" }}>
                            {activeTab === "ai" ? (
                                <HubAiView
                                    aiOnline={aiChat?.aiOnline}
                                    aiStatus={aiStatus}
                                    audioStatus={audioStatus}
                                    isConnected={isConnected}
                                    messages={aiChat?.messages || []}
                                    input={aiChat?.input || ""}
                                    setInput={aiChat?.setInput}
                                    onSend={aiChat?.handleSend}
                                    recording={aiChat?.recording}
                                    onToggleMic={aiChat?.recording ? aiChat?.stopMic : aiChat?.startMic}
                                    micBlocked={aiChat?.micBlocked}
                                    actions={aiChat?.ACTIONS || []}
                                    activeExecutingAction={activeExecutingAction}
                                    onExecuteAction={aiChat?.handleExecuteAction}
                                    onStopAll={stopAll}
                                    isThinking={aiChat?.isThinking}
                                    thoughtText={aiChat?.thoughtText}
                                    thoughtTps={aiChat?.thoughtTps}
                                    thoughtElapsed={aiChat?.thoughtElapsed}
                                    currentPlan={aiChat?.currentPlan}
                                    activeStepIndex={aiChat?.activeStepIndex}
                                    isConfigOpen={aiChat?.isConfigOpen}
                                    setIsConfigOpen={aiChat?.setIsConfigOpen}
                                    onUpdateConfig={aiChat?.handleUpdateConfig}
                                    smartSpeaker={smartSpeaker}
                                    setSmartSpeaker={setSmartSpeaker}
                                    sentinel={sentinel}
                                    sentinelLog={sentinelLog}
                                    memoryState={memoryState || aiChat?.memoryState}
                                    publishAiMemory={publishAiMemory || aiChat?.publishAiMemory}
                                />
                            ) : (
                                <HubSystemView
                                    publishImmediate={publishImmediate}
                                    isAwake={isAwake}
                                    onTogglePower={handlePowerToggle}
                                    logs={logs}
                                    clearLogs={clearLogs}
                                />
                            )}
                        </div>
                    )}
                </div>
        </>
    )
}

export default AiChatOverlay