// web-ui/src/components/pages/AIPanel.js
import React, { useEffect } from "react"
import { SECTION_NAMES } from "../vars"
import { AiStatusBar } from "../ai/AiStatusBar"
import { AiChatTerminal } from "../ai/AiChatTerminal"
import { AiInputControls } from "../ai/AiInputControls"
import { AiActionGrid } from "../ai/AiActionGrid"
import { AiTaskStepper } from "../ai/AiTaskStepper"

const AIPanel = ({
    aiStatus = null,
    audioStatus = null,
    isConnected = false,
    onMount = () => {},
    clearAiMessages = () => {},
    aiChat,
    activeExecutingAction,
    stopAll,
}) => {
    useEffect(() => {
        onMount(SECTION_NAMES.ai)
    }, [onMount])

    return (
        <div className="border" style={{ margin: "10px", padding: "12px", background: "rgba(15, 23, 42, 0.65)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h2 style={{ margin: 0, fontSize: "1.3rem", color: "var(--c1-green)" }}>
                    AI Assistant & Direct Actions
                </h2>
                <div style={{ display: "flex", gap: "6px" }}>
                    {activeExecutingAction && (
                        <span
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "2px 8px",
                                borderRadius: "10px",
                                background: "rgba(252, 66, 123, 0.2)",
                                border: "1px solid var(--c2-pink)",
                                color: "var(--c2-pink)",
                                fontSize: "0.65rem",
                            }}
                        >
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c2-pink)" }} />
                            Active: {activeExecutingAction}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            if (aiChat && aiChat.setMessages) {
                                aiChat.setMessages([])
                            }
                            clearAiMessages()
                        }}
                        style={{
                            padding: "2px 8px",
                            fontSize: "0.65rem",
                            cursor: "pointer",
                            background: "rgba(23, 33, 43, 0.85)",
                            color: "#e2e8f0",
                            border: "1px solid rgba(41, 128, 185, 0.5)",
                            borderRadius: "5px",
                        }}
                        disabled={!aiChat || aiChat.messages.length === 0}
                    >
                        Clear Chat
                    </button>
                </div>
            </div>

            <AiStatusBar aiOnline={aiChat?.aiOnline} aiStatus={aiStatus} audioStatus={audioStatus} isConnected={isConnected} />

            <AiTaskStepper
                isThinking={aiChat?.isThinking}
                thoughtText={aiChat?.thoughtText}
                thoughtTps={aiChat?.thoughtTps}
                thoughtElapsed={aiChat?.thoughtElapsed}
                currentPlan={aiChat?.currentPlan}
                activeStepIndex={aiChat?.activeStepIndex}
                onAbort={stopAll}
            />

            <AiChatTerminal messages={aiChat?.messages || []} />
            <AiInputControls
                input={aiChat?.input || ""}
                setInput={aiChat?.setInput}
                onSend={aiChat?.handleSend}
                recording={aiChat?.recording}
                onToggleMic={aiChat?.recording ? aiChat?.stopMic : aiChat?.startMic}
                micBlocked={aiChat?.micBlocked}
                aiOnline={aiChat?.aiOnline}
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

export default AIPanel