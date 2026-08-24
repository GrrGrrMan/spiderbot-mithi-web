// web-ui/src/components/pages/AIPanel.js
import React, { useEffect, useState } from "react"
import { SECTION_NAMES } from "../vars"
import { AiAssistantView } from "../ai/AiAssistantView"

const AIPanel = (props) => {
    const { onMount = () => {}, aiChat, clearAiMessages = () => {} } = props
    const [localConfigOpen, setLocalConfigOpen] = useState(false)
    const isConfigOpen = aiChat?.isConfigOpen !== undefined ? aiChat.isConfigOpen : localConfigOpen
    const toggleConfig = aiChat?.setIsConfigOpen ? () => aiChat.setIsConfigOpen(prev => !prev) : () => setLocalConfigOpen(prev => !prev)

    useEffect(() => {
        onMount(SECTION_NAMES.ai)
    }, [onMount])

    return (
        <div className="border" style={{ margin: "10px", padding: "12px", background: "rgba(15, 23, 42, 0.65)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h2 style={{ margin: 0, fontSize: "1.3rem", color: "var(--c1-green)" }}>
                    AI Assistant & Direct Actions
                </h2>
                <button
                    type="button"
                    onClick={() => {
                        if (aiChat?.setMessages) aiChat.setMessages([])
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
                    disabled={!aiChat || aiChat.messages?.length === 0}
                >
                    Clear Chat
                </button>
            </div>

            <AiAssistantView
                {...props}
                isConfigOpen={isConfigOpen}
                onToggleConfig={toggleConfig}
                variant="page"
            />
        </div>
    )
}

export default AIPanel