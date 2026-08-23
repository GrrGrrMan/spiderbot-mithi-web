// web-ui/src/components/ai/AiChatTerminal.js
import React, { useEffect, useRef } from "react"

export const AiChatTerminal = ({ messages = [] }) => {
    const chatRef = useRef(null)

    useEffect(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
    }, [messages])

    // Safe string renderer — guarantees objects or tool calls never crash React
    const renderContent = (content) => {
        if (typeof content === "string") return content
        if (typeof content === "object" && content !== null) {
            return JSON.stringify(content, null, 2)
        }
        return String(content ?? "")
    }

    return (
        <div
            ref={chatRef}
            style={{
                height: 170,
                overflowY: "auto",
                border: "1px solid rgba(41, 128, 185, 0.4)",
                borderRadius: "6px",
                padding: "8px",
                marginBottom: "8px",
                background: "rgba(10, 15, 25, 0.7)",
            }}
        >
            {messages.length === 0 && (
                <div style={{ textAlign: "center", paddingTop: 55, color: "#64748b", fontSize: "0.75rem" }}>
                    Click any action button below or press "Talk" to record a command.
                </div>
            )}
            {messages.map((m, i) => {
                const isUser = m.role === "user"
                const isSystem = m.role === "system"
                const bubbleBg = isUser ? "rgba(50, 255, 126, 0.2)" : isSystem ? "rgba(255, 33, 33, 0.15)" : "rgba(41, 128, 185, 0.5)"
                const textColor = isUser ? "var(--c1-green)" : isSystem ? "#fca5a5" : "#fff"

                return (
                    <div key={i} style={{ textAlign: isUser ? "right" : "left", marginBottom: 6 }}>
                        <span
                            style={{
                                display: "inline-block",
                                maxWidth: "85%",
                                padding: "5px 10px",
                                borderRadius: "8px",
                                background: bubbleBg,
                                border: `1px solid ${isUser ? "rgba(50, 255, 126, 0.4)" : isSystem ? "rgba(255, 33, 33, 0.4)" : "rgba(41, 128, 185, 0.4)"}`,
                                color: textColor,
                                fontSize: "0.75rem",
                                wordBreak: "break-word",
                                whiteSpace: "pre-wrap",
                                textAlign: "left",
                            }}
                        >
                            {renderContent(m.content)}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}