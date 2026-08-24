// web-ui/src/components/ai/AiInputControls.js
import React from "react"

export const AiInputControls = ({
    input = "",
    setInput = () => {},
    onSend = () => {},
    recording = false,
    onToggleMic = () => {},
    micBlocked = false,
    aiOnline = false,
}) => (
    <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
        <input
            type="text"
            value={input || ""}
            onChange={e => (typeof setInput === "function" ? setInput(e.target.value) : undefined)}
            onKeyDown={e => e.key === "Enter" && typeof onSend === "function" && onSend()}
            placeholder={aiOnline ? "Ask AI assistant anything…" : "Type a direct command (e.g., 'walk forward')…"}
            style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid rgba(41, 128, 185, 0.5)",
                background: "rgba(10, 15, 25, 0.8)",
                color: "#fff",
                height: "2.2rem",
            }}
            aria-label="AI input"
        />
        <button
            type="button"
            onClick={onSend}
            style={{ ...btnStyle, background: "var(--c4-blue)", color: "#fff", height: "2.2rem" }}
            disabled={!input || !input.trim()}
        >
            Send
        </button>
        <button
            type="button"
            onClick={onToggleMic}
            style={{
                ...btnStyle,
                background: recording ? "var(--c6-red)" : "rgba(23, 33, 43, 0.9)",
                color: recording ? "#fff" : "var(--c1-green)",
                height: "2.2rem",
                minWidth: "75px",
            }}
            disabled={micBlocked}
            title={micBlocked ? "Microphone unavailable" : recording ? "Stop and send recording" : "Record voice query"}
        >
            {recording ? "⏹ Stop" : "🎤 Talk"}
        </button>
    </div>
)

const btnStyle = {
    padding: "5px 9px",
    borderRadius: "5px",
    border: "1px solid rgba(41, 128, 185, 0.5)",
    background: "rgba(23, 33, 43, 0.85)",
    color: "#e2e8f0",
    cursor: "pointer",
    fontSize: "0.72rem",
    fontWeight: "500",
}