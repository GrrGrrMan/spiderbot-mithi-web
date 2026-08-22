// web-ui/src/components/ai/SentinelStatusCard.js
import React from "react"

export const SentinelStatusCard = ({
    wakeWordState,
    isListening,
    micError,
    lastTranscript,
    lastAcceptedCommand,
    actionLog = [],
}) => (
    <div className="border" style={{ padding: "12px", backgroundColor: "rgba(15, 23, 42, 0.75)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <h3 style={{ margin: 0, color: "var(--c1-green)", fontSize: "0.95rem" }}>
                24/7 PASSIVE WAKE-WORD SENTINEL
            </h3>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span style={stateBadgeStyle(wakeWordState, isListening)}>
                    <span style={pulseDotStyle(isListening)} />
                    {getStatusLabel(wakeWordState, isListening)}
                </span>
            </div>
        </div>

        {micError && (
            <div style={{ color: "var(--c6-red)", fontSize: "0.75rem", marginBottom: "8px" }}>
                ⚠️ {micError}
            </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "0.72rem" }}>
            <div style={panelBoxStyle}>
                <div style={{ color: "#94a3b8", fontWeight: "bold", marginBottom: "4px" }}>
                    AUDIO STREAM ANALYSIS:
                </div>
                <div style={{ marginBottom: "4px" }}>
                    <strong>Heard Raw:</strong>{" "}
                    <span style={{ color: "#cbd5e1" }}>{lastTranscript || "(Waiting for speech...)"}</span>
                </div>
                <div>
                    <strong>Active Command:</strong>{" "}
                    <span style={{ color: "var(--c1-green)", fontWeight: "bold" }}>
                        {lastAcceptedCommand || "None (Filter Active)"}
                    </span>
                </div>
            </div>

            <div style={panelBoxStyle}>
                <div style={{ color: "#94a3b8", fontWeight: "bold", marginBottom: "4px" }}>
                    GATE CRITERIA:
                </div>
                <div style={{ color: "#94a3b8" }}>
                    • Responds <strong>ONLY</strong> to <code>"Hey Spider &lt;action&gt;"</code> or <code>"Hey Hexapod &lt;action&gt;"</code>.
                    <br />
                    • Ambient speech, mumbling, and unrelated background sounds are automatically dropped.
                </div>
            </div>
        </div>

        {actionLog.length > 0 && (
            <div style={{ marginTop: "10px" }}>
                <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "bold", marginBottom: "4px" }}>
                    DIRECTIVE HISTORY:
                </div>
                <div style={historyBoxStyle}>
                    {actionLog.map(item => (
                        <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                            <span style={{ color: "var(--c4-blue)" }}>[{item.time}]</span>
                            <span style={{ flex: 1, color: "var(--c1-green)" }}>{item.command}</span>
                            <span style={{ color: "#64748b", fontSize: "0.65rem" }}>"{item.full}"</span>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
)

const getStatusLabel = (state, isListening) => {
    if (!isListening) return "MIC OFFLINE"
    if (state === "recognized") return "WAKE WORD TRIGGERED"
    if (state === "listening_prompt") return "HEARD WAKE WORD — AWAITING DIRECTIVE"
    if (state === "ignored") return "AMBIENT CHATTER DROPPED"
    return "24/7 LISTENING ('Hey Spider...')"
}

const stateBadgeStyle = (state, isListening) => {
    let bg = "rgba(50, 255, 126, 0.15)"
    let border = "var(--c1-green)"
    let color = "var(--c1-green)"

    if (!isListening) {
        bg = "rgba(255, 33, 33, 0.15)"
        border = "var(--c6-red)"
        color = "var(--c6-red)"
    } else if (state === "recognized") {
        bg = "rgba(252, 66, 123, 0.25)"
        border = "var(--c2-pink)"
        color = "var(--c2-pink)"
    } else if (state === "ignored") {
        bg = "rgba(100, 116, 139, 0.2)"
        border = "#64748b"
        color = "#94a3b8"
    }

    return {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "3px 10px",
        borderRadius: "12px",
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color: color,
        fontSize: "0.68rem",
        fontWeight: "bold",
    }
}

const pulseDotStyle = active => ({
    width: 6,
    height: 6,
    borderRadius: "50%",
    backgroundColor: active ? "var(--c1-green)" : "var(--c6-red)",
    display: "inline-block",
})

const panelBoxStyle = {
    padding: "8px",
    borderRadius: "6px",
    backgroundColor: "rgba(10, 15, 25, 0.7)",
    border: "1px solid rgba(41, 128, 185, 0.3)",
}

const historyBoxStyle = {
    maxHeight: "90px",
    overflowY: "auto",
    padding: "6px",
    borderRadius: "4px",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    fontSize: "0.68rem",
    fontFamily: "monospace",
}