// web-ui/src/components/hub/HubAiView.js
import React from "react"
import { AiStatusBar } from "../ai/AiStatusBar"
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
}) => (
    <>
        <AiStatusBar aiOnline={aiOnline} aiStatus={aiStatus} audioStatus={audioStatus} isConnected={isConnected} />
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
        <div style={{ maxHeight: "185px", overflowY: "auto", paddingRight: "4px" }}>
            <AiActionGrid
                actions={actions}
                activeExecutingAction={activeExecutingAction}
                onExecuteAction={onExecuteAction}
                onStopAll={onStopAll}
            />
        </div>
    </>
)