// web-ui/src/components/hub/HubAiView.js
import React from "react"
import { AiStatusBar } from "../ai/AiStatusBar"
import { AiConfigDrawer } from "../ai/AiConfigDrawer"
import { AiTaskStepper } from "../ai/AiTaskStepper"
import { AiChatTerminal } from "../ai/AiChatTerminal"
import { AiInputControls } from "../ai/AiInputControls"
import { AiActionGrid } from "../ai/AiActionGrid"

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
}) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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