// web-ui/src/components/ai/SentinelStatusCard.js
import React from "react"
import { FaMicrophone, FaExclamationTriangle } from "react-icons/fa"

export const SentinelStatusCard = ({
    wakeWordState,
    isListening,
    micError,
    lastTranscript,
    lastAcceptedCommand,
}) => {
    const badge = getBadgeConfig(wakeWordState, isListening, micError)
    const contentText = getContentText(wakeWordState, isListening, micError, lastTranscript, lastAcceptedCommand)

    const tooltipText = 
        "Smart Speaker Wake-Word Sentinel:\n" +
        "• Commands: 'Hey Spider <action>' or 'Hey Hexapod <action>'\n" +
        "• Passive Filter: Ambient chatter and background noise are automatically dropped."

    return (
        <div
            style={containerStyle}
            title={tooltipText}
            data-testid="sentinel-status-bar"
        >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
                {micError ? (
                    <FaExclamationTriangle style={{ color: "var(--c6-red)", fontSize: "0.8rem", flexShrink: 0 }} />
                ) : (
                    <FaMicrophone
                        style={{
                            color: isListening ? (wakeWordState === "recognized" ? "var(--c1-green)" : "var(--c4-blue)") : "#64748b",
                            fontSize: "0.8rem",
                            flexShrink: 0,
                        }}
                    />
                )}

                <div style={{ fontSize: "0.7rem", color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: "bold", color: "#cbd5e1", marginRight: "4px" }}>
                        Voice Stream:
                    </span>
                    <span style={{ color: badge.textColor }}>
                        {contentText}
                    </span>
                </div>
            </div>

            <span
                style={{
                    fontSize: "0.6rem",
                    fontWeight: "bold",
                    letterSpacing: "0.05em",
                    padding: "2px 7px",
                    borderRadius: "4px",
                    backgroundColor: badge.bg,
                    color: badge.color,
                    border: `1px solid ${badge.border}`,
                    flexShrink: 0,
                    marginLeft: "8px",
                }}
            >
                {badge.label}
            </span>
        </div>
    )
}

const getContentText = (state, isListening, micError, lastTranscript, lastAcceptedCommand) => {
    if (micError) return micError
    if (!isListening) return "Microphone offline"
    if (state === "recognized" && lastAcceptedCommand) return `"${lastAcceptedCommand}"`
    if (state === "listening_prompt") return "Heard wake-word — awaiting directive..."
    if (state === "ignored" && lastTranscript) return `Dropped "${lastTranscript}"`
    if (lastTranscript) return `"${lastTranscript}"`
    return 'Listening for "Hey Hexa..."'
}

const getBadgeConfig = (state, isListening, micError) => {
    if (micError || !isListening) {
        return {
            label: "OFFLINE",
            color: "var(--c6-red)",
            textColor: "#f87171",
            bg: "rgba(255, 33, 33, 0.15)",
            border: "rgba(255, 33, 33, 0.3)",
        }
    }
    if (state === "recognized") {
        return {
            label: "TRIGGERED",
            color: "var(--c1-green)",
            textColor: "var(--c1-green)",
            bg: "rgba(50, 255, 126, 0.15)",
            border: "var(--c1-green)",
        }
    }
    if (state === "listening_prompt") {
        return {
            label: "AWAITING",
            color: "#38bdf8",
            textColor: "#38bdf8",
            bg: "rgba(56, 189, 248, 0.15)",
            border: "#38bdf8",
        }
    }
    if (state === "ignored") {
        return {
            label: "FILTERED",
            color: "#94a3b8",
            textColor: "#94a3b8",
            bg: "rgba(100, 116, 139, 0.15)",
            border: "rgba(100, 116, 139, 0.3)",
        }
    }
    return {
        label: "LISTENING",
        color: "var(--c4-blue)",
        textColor: "#94a3b8",
        bg: "rgba(41, 128, 185, 0.15)",
        border: "rgba(41, 128, 185, 0.3)",
    }
}

const containerStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "6px",
    backgroundColor: "rgba(10, 15, 25, 0.5)",
    border: "1px solid rgba(41, 128, 185, 0.25)",
    marginBottom: "8px",
    cursor: "help",
}

export default SentinelStatusCard