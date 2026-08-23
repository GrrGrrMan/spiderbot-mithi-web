// FILE: src/components/ai/AiChatOverlay.js
import React, { useState, useCallback } from "react"
import { FaRobot, FaTerminal } from "react-icons/fa"
import { useDraggableModal } from "../../hooks/useDraggableModal"
import { useAiMotionExecutor } from "../../hooks/useAiMotionExecutor"
import { useAiChat } from "../../hooks/useAiChat"
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
    publishAi = () => {},
    publishAudio = () => {},
    aiMessages = [],
    aiStatus = null,
    audioStatus = null,
    isConnected = false,
    clearAiMessages = () => {},
    params = {},
    onUpdate = () => {},
    logs = [],
    clearLogs = () => {},
    telemetry = null,
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

    // Permissive Window Drag & Auto-Recovery Hook
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

    const { activeExecutingAction, triggerAction, stopAll } = useAiMotionExecutor({
        params,
        publishImmediate,
        publishAudio,
        onUpdate,
    })

    const { messages, setMessages, input, setInput, handleSend, handleExecuteAction, recording, micBlocked, startMic, stopMic, aiOnline, ACTIONS } =
        useAiChat({ aiMessages, aiStatus, publishAi, triggerAction })

    const activeConfig = TAB_CONFIG.find(t => t.id === activeTab) || TAB_CONFIG[0]

    return (
        <>
            <HubFab isOpen={isOpen} onToggle={onToggle} activeColor={activeConfig.color} isExecuting={Boolean(activeExecutingAction)} />

            {isOpen && (
                <div
                    ref={cardRef}
                    style={{
                        position: "fixed",
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        width: "440px",
                        maxWidth: "calc(100vw - 20px)",
                        maxHeight: "calc(100vh - 85px)",
                        overflowY: "auto",
                        zIndex: 80,
                        backgroundColor: "rgba(15, 23, 42, 0.96)",
                        backdropFilter: "blur(14px)",
                        border: `1.5px solid ${isDragging ? "var(--c1-green)" : "var(--c4-blue)"}`,
                        borderRadius: "10px",
                        padding: "10px 12px",
                        boxShadow: isDragging
                            ? "0 16px 40px rgba(0, 0, 0, 0.85), 0 0 25px rgba(50, 255, 126, 0.3)"
                            : "0 12px 36px rgba(0, 0, 0, 0.75), 0 0 18px rgba(41, 128, 185, 0.3)",
                        userSelect: isDragging ? "none" : "auto",
                        // Zero lag during drag; spring recovery when dropped out-of-bounds
                        transition: isDragging
                            ? "none"
                            : "left 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s, border-color 0.2s",
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
                                setMessages([])
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

                    {!isMinimized && (
                        <div className="no-drag" style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                            {activeTab === "ai" ? (
                                <HubAiView
                                    aiOnline={aiOnline}
                                    aiStatus={aiStatus}
                                    audioStatus={audioStatus}
                                    isConnected={isConnected}
                                    messages={messages}
                                    input={input}
                                    setInput={setInput}
                                    onSend={handleSend}
                                    recording={recording}
                                    onToggleMic={recording ? stopMic : startMic}
                                    micBlocked={micBlocked}
                                    actions={ACTIONS}
                                    activeExecutingAction={activeExecutingAction}
                                    onExecuteAction={handleExecuteAction}
                                    onStopAll={stopAll}
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
            )}
        </>
    )
}

export default AiChatOverlay