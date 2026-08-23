// web-ui/src/components/hub/HubAiView.js
import React from "react"
import { AiStatusBar } from "../ai/AiStatusBar"
import { AiConfigDrawer } from "../ai/AiConfigDrawer"
import { AiTaskStepper } from "../ai/AiTaskStepper"
import { AiChatTerminal } from "../ai/AiChatTerminal"
import { AiInputControls } from "../ai/AiInputControls"
import { AiActionGrid } from "../ai/AiActionGrid"
import { SentinelStatusCard } from "../ai/SentinelStatusCard"

export const HubAiView = ({
    aiOnline,
    aiStatus,
    audioStatus,
    isConnected,
    messages,
    input,
    setInput,
    onSend,
    recording,
    onToggleMic,
    micBlocked,
    actions,
    activeExecutingAction,
    onExecuteAction,
    onStopAll,
    isThinking,
    thoughtText,
    thoughtTps,
    thoughtElapsed,
    currentPlan,
    activeStepIndex,
    isConfigOpen,
    setIsConfigOpen,
    onUpdateConfig,
    smartSpeaker,
    setSmartSpeaker,
    sentinel,
    sentinelLog,
}) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: smartSpeaker ? "rgba(50, 255, 126, 0.1)" : "rgba(15, 23, 42, 0.6)", borderRadius: "6px", border: `1px solid ${smartSpeaker ? "var(--c1-green)" : "rgba(41, 128, 185, 0.3)"}` }}>
            <span style={{ fontSize: "0.75rem", fontWeight: "bold", color: smartSpeaker ? "var(--c1-green)" : "#94a3b8" }}>
                <span role="img" aria-label="mic">{smartSpeaker ? "🎙️" : "🔇"}</span> Smart Speaker Mode
            </span>
            <button
                type="button"
                onClick={() => setSmartSpeaker(!smartSpeaker)}
                style={{
                    padding: "4px 10px",
                    borderRadius: "12px",
                    backgroundColor: smartSpeaker ? "rgba(50, 255, 126, 0.2)" : "rgba(23, 33, 43, 0.8)",
                    border: `1px solid ${smartSpeaker ? "var(--c1-green)" : "rgba(41, 128, 185, 0.5)"}`,
                    color: smartSpeaker ? "var(--c1-green)" : "#cbd5e1",
                    fontSize: "0.65rem",
                    fontWeight: "bold",
                    cursor: "pointer",
                }}
            >
                {smartSpeaker ? "ON" : "OFF"}
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
            onToggleConfig={() => setIsConfigOpen(prev => !prev)}
            isConfigOpen={isConfigOpen}
        />

        <AiConfigDrawer
            isOpen={isConfigOpen}
            aiStatus={aiStatus}
            onUpdateConfig={onUpdateConfig}
        />

        <AiTaskStepper
            isThinking={isThinking}
            thoughtText={thoughtText}
            thoughtTps={thoughtTps}
            thoughtElapsed={thoughtElapsed}
            currentPlan={currentPlan}
            activeStepIndex={activeStepIndex}
            onAbort={onStopAll}
        />

        <AiChatTerminal messages={messages} />

        <AiInputControls
            input={input}
            setInput={setInput}
            onSend={onSend}
            recording={recording}
            onToggleMic={onToggleMic}
            micBlocked={micBlocked}
            aiOnline={aiOnline}
        />

        <AiActionGrid
            actions={actions}
            activeExecutingAction={activeExecutingAction}
            onExecuteAction={onExecuteAction}
            onStopAll={onStopAll}
        />
    </div>
)