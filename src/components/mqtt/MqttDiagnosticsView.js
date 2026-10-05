// src/components/mqtt/MqttDiagnosticsView.js
import React from "react"
import {
    FaCheck,
    FaTimes,
    FaSpinner,
    FaMinus,
    FaExclamationTriangle,
} from "react-icons/fa"
import {
    PROBE_STAGES,
    PROBE_STATUS,
    PROBE_STAGE_METADATA,
} from "../../services/mqtt/probeStages"

export const MqttDiagnosticsView = ({ stages, isRunning, summary, onDismiss }) => {
    const stageKeys = Object.values(PROBE_STAGES)

    return (
        <div style={containerStyle} data-testid="mqtt-diagnostics-view">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "0.68rem", fontWeight: "bold", color: "#f8fafc" }}>
                    PROBE DIAGNOSTIC RESULTS
                </span>
                {onDismiss && (
                    <button type="button" onClick={onDismiss} style={dismissBtnStyle}>
                        Close
                    </button>
                )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {stageKeys.map(key => {
                    const data = stages[key] || { status: PROBE_STATUS.IDLE, message: "" }
                    const meta = PROBE_STAGE_METADATA[key]
                    const status = data.status

                    return (
                        <div
                            key={key}
                            style={{
                                ...rowStyle,
                                borderColor:
                                    status === PROBE_STATUS.ERROR
                                        ? "var(--c6-red)"
                                        : status === PROBE_STATUS.SUCCESS
                                        ? "rgba(50, 255, 126, 0.4)"
                                        : "rgba(41, 128, 185, 0.25)",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                {status === PROBE_STATUS.RUNNING ? (
                                    <FaSpinner className="spin" style={{ color: "var(--c1-green)", fontSize: "0.65rem" }} />
                                ) : status === PROBE_STATUS.SUCCESS ? (
                                    <FaCheck style={{ color: "var(--c1-green)", fontSize: "0.65rem" }} />
                                ) : status === PROBE_STATUS.ERROR ? (
                                    <FaTimes style={{ color: "var(--c6-red)", fontSize: "0.65rem" }} />
                                ) : status === PROBE_STATUS.SKIPPED ? (
                                    <FaMinus style={{ color: "#64748b", fontSize: "0.6rem" }} />
                                ) : (
                                    <span style={bulletStyle} />
                                )}

                                <span style={{ fontSize: "0.65rem", fontWeight: "bold", color: "#e2e8f0" }}>
                                    {meta.label}
                                </span>
                            </div>

                            {data.message && (
                                <span
                                    style={{
                                        fontSize: "0.62rem",
                                        color:
                                            status === PROBE_STATUS.ERROR
                                                ? "#f87171"
                                                : status === PROBE_STATUS.SUCCESS
                                                ? "var(--c1-green)"
                                                : "#94a3b8",
                                        textAlign: "right",
                                        maxWidth: "55%",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                    title={data.message}
                                >
                                    {data.message}
                                </span>
                            )}
                        </div>
                    )
                })}
            </div>

            {summary && summary.error && (
                <div style={errorCalloutStyle}>
                    <FaExclamationTriangle style={{ fontSize: "0.75rem", flexShrink: 0 }} />
                    <span>{summary.error}</span>
                </div>
            )}
        </div>
    )
}

const containerStyle = {
    padding: "8px",
    borderRadius: "6px",
    backgroundColor: "rgba(10, 15, 25, 0.85)",
    border: "1px solid rgba(41, 128, 185, 0.35)",
    marginBottom: "10px",
}

const rowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "3px 6px",
    borderRadius: "4px",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    border: "1px solid",
}

const bulletStyle = {
    width: 6,
    height: 6,
    borderRadius: "50%",
    backgroundColor: "#64748b",
    display: "inline-block",
}

const dismissBtnStyle = {
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    fontSize: "0.6rem",
    cursor: "pointer",
}

const errorCalloutStyle = {
    display: "flex",
    alignItems: "flex-start",
    gap: "6px",
    padding: "6px",
    marginTop: "6px",
    borderRadius: "4px",
    backgroundColor: "rgba(255, 33, 33, 0.15)",
    border: "1px solid var(--c6-red)",
    color: "#fca5a5",
    fontSize: "0.62rem",
    lineHeight: "0.9rem",
}

export default MqttDiagnosticsView