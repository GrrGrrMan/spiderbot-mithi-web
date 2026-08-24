// web-ui/src/components/ai/AiAssistantView.js
import React from "react"
import { AiStatusBar } from "./AiStatusBar"
import { AiConfigDrawer } from "./AiConfigDrawer"
import { AiTaskStepper } from "./AiTaskStepper"
import { AiChatTerminal } from "./AiChatTerminal"
import { AiInputControls } from "./AiInputControls"
import { AiActionGrid } from "./AiActionGrid"
import { SentinelStatusCard } from "./SentinelStatusCard"

export const AiAssistantView = ({
    aiChat,
    aiStatus,
    audioStatus,
    isConnected,
    memoryState,
    publishAiMemory,
    activeExecutingAction,
    stopAll,
    smartSpeaker,
    setSmartSpeaker,
    sentinel,
    sentinelLog,
    isConfigOpen,
    onToggleConfig,
    variant = "hub", // "hub" | "page"
}) => {
    const aiOnline = aiChat?.aiOnline ?? Boolean(aiStatus && aiStatus.state !== "offline")
    const messages = aiChat?.messages || []

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* Smart Speaker Sentinel Control */}
            <div
                title="When active, say 'Hey Spider <action>' or 'Hey Hexapod <action>' to trigger motions hands-free."
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 10px",
                    background: smartSpeaker ? "rgba(50, 255, 126, 0.08)" : "rgba(15, 23, 42, 0.6)",
                    borderRadius: "6px",
                    border: `1px solid ${smartSpeaker ? "rgba(50, 255, 126, 0.3)" : "rgba(41, 128, 185, 0.25)"}`,
                }}
            >
                <span style={{ fontSize: "0.75rem", fontWeight: "bold", color: smartSpeaker ? "var(--c1-green)" : "#94a3b8" }}>
                    <span role="img" aria-label="mic">{smartSpeaker ? "🎙️" : "🔇"}</span> Smart Speaker Sentinel
                </span>
                <button
                    type="button"
                    onClick={() => setSmartSpeaker(!smartSpeaker)}
                    style={{
                        padding: "3px 10px",
                        borderRadius: "12px",
                        backgroundColor: smartSpeaker ? "rgba(50, 255, 126, 0.2)" : "rgba(23, 33, 43, 0.8)",
                        border: `1px solid ${smartSpeaker ? "var(--c1-green)" : "rgba(41, 128, 185, 0.5)"}`,
                        color: smartSpeaker ? "var(--c1-green)" : "#cbd5e1",
                        fontSize: "0.65rem",
                        fontWeight: "bold",
                        cursor: "pointer",
                    }}
                >
                    {smartSpeaker ? "ACTIVE" : "DISABLED"}
                </button>
            </div>

            {smartSpeaker && sentinel && (
                <SentinelStatusCard
                    wakeWordState={sentinel.wakeWordState}
                    isListening={sentinel.isListening}
                    micError={sentinel.micError}
                    lastTranscript={sentinel.lastTranscript}
                    lastAcceptedCommand={sentinel.lastAcceptedCommand}
                    actionLog={sentinelLog}
                />
            )}

            <AiStatusBar
                aiOnline={aiOnline}
                aiStatus={aiStatus}
                audioStatus={audioStatus}
                isConnected={isConnected}
                onToggleConfig={onToggleConfig}
                isConfigOpen={isConfigOpen}
            />

            <AiConfigDrawer
                isOpen={isConfigOpen}
                aiStatus={aiStatus}
                onUpdateConfig={aiChat?.handleUpdateConfig || (() => {})}
                memoryState={memoryState || aiChat?.memoryState}
                publishAiMemory={publishAiMemory || aiChat?.publishAiMemory}
            />

            <AiTaskStepper
                isThinking={aiChat?.isThinking}
                thoughtText={aiChat?.thoughtText}
                thoughtTps={aiChat?.thoughtTps}
                thoughtElapsed={aiChat?.thoughtElapsed}
                currentPlan={aiChat?.currentPlan}
                activeStepIndex={aiChat?.activeStepIndex}
                onAbort={stopAll}
            />

            <AiChatTerminal messages={messages} />

            <AiInputControls
                input={aiChat?.input || ""}
                setInput={aiChat?.setInput}
                onSend={aiChat?.handleSend}
                recording={aiChat?.recording}
                onToggleMic={aiChat?.recording ? aiChat?.stopMic : aiChat?.startMic}
                micBlocked={aiChat?.micBlocked}
                aiOnline={aiOnline}
            />

            <AiActionGrid
                actions={aiChat?.ACTIONS || []}
                activeExecutingAction={activeExecutingAction}
                onExecuteAction={aiChat?.handleExecuteAction}
                onStopAll={stopAll}
            />
        </div>
    )
}

export default AiAssistantView