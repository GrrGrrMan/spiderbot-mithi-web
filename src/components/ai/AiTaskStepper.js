// web-ui/src/components/ai/AiTaskStepper.js
import React, { useState } from "react"
import { FaChevronDown, FaChevronUp, FaBrain, FaSpinner, FaStop, FaCheck, FaCheckCircle } from "react-icons/fa"

export const AiTaskStepper = ({
    taskStatus = "idle",    // "idle" | "running" | "completed"
    isThinking = false,
    thoughtText = "",
    thoughtTps = null,
    thoughtElapsed = 0,
    currentPlan = null,
    activeStepIndex = 0,
    onAbort = () => {},
}) => {
    const [isExpanded, setIsExpanded] = useState(true)

    const isCompleted = taskStatus === "completed"
    const isRunning = taskStatus === "running" || isThinking

    // ── 1. Initial First-Load State (Idle) ──
    if (taskStatus === "idle" && !currentPlan && !thoughtText) {
        return (
            <div style={idleBoxStyle} data-testid="ai-task-stepper-idle">
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <FaBrain style={{ color: "var(--c4-blue)", fontSize: "0.8rem" }} />
                    <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                        Cognitive Pipeline: <strong style={{ color: "#cbd5e1" }}>Standing By</strong>
                    </span>
                </div>
                <span style={idleBadgeStyle}>IDLE</span>
            </div>
        )
    }

    const showThought = Boolean(thoughtText || isRunning || isCompleted)
    const showPlan = Boolean(currentPlan && currentPlan.steps?.length > 0)

    return (
        <div style={containerStyle} data-testid="ai-task-stepper">
            {/* ── 2. Deliberation Trace Accordion ── */}
            {showThought && (
                <div style={thoughtBoxStyle}>
                    <button
                        type="button"
                        onClick={() => setIsExpanded(prev => !prev)}
                        style={thoughtHeaderBtnStyle}
                        aria-expanded={isExpanded}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <FaBrain style={{ color: isRunning ? "var(--c1-green)" : isCompleted ? "#38bdf8" : "#94a3b8", fontSize: "0.85rem" }} />
                            <span style={{ fontWeight: "bold", fontSize: "0.72rem", color: isRunning ? "var(--c1-green)" : "#cbd5e1" }}>
                                {isRunning ? "Thinking Process" : "Deliberation Summary"}
                            </span>

                            {/* Badge */}
                            {isRunning && (
                                <span style={tpsBadgeStyle}>
                                    <FaSpinner className="spin" style={{ fontSize: "0.6rem" }} />
                                    {thoughtTps ? `${thoughtTps} tok/s` : "Reasoning"} • {thoughtElapsed ? `${thoughtElapsed.toFixed(1)}s` : "0.0s"}
                                </span>
                            )}
                            {isCompleted && (
                                <span style={completeBadgeStyle}>
                                    <FaCheck style={{ fontSize: "0.55rem" }} /> Finished {thoughtElapsed > 0 ? `(${thoughtElapsed.toFixed(1)}s)` : ""}
                                </span>
                            )}
                        </div>
                        {isExpanded ? <FaChevronUp style={{ fontSize: "0.6rem" }} /> : <FaChevronDown style={{ fontSize: "0.6rem" }} />}
                    </button>

                    {isExpanded && (
                        <div style={thoughtContentStyle}>
                            <p style={{
                                margin: 0,
                                whiteSpace: "pre-wrap",
                                fontSize: "0.7rem",
                                color: "#94a3b8",
                                lineHeight: "1.2rem",
                                maxHeight: "140px",
                                overflowY: "auto",
                                wordBreak: "break-word"
                            }}>
                                {thoughtText || (isCompleted ? "Goal evaluation finished." : "Deliberating visual data and inverse kinematics...")}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* ── 3. Execution Plan Checklist (Persistent until next task) ── */}
            {showPlan && (
                <div style={{
                    ...planCardStyle,
                    borderColor: isCompleted ? "rgba(56, 189, 248, 0.4)" : "rgba(50, 255, 126, 0.35)",
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <span style={{ fontSize: "0.74rem", fontWeight: "bold", color: "#f8fafc", letterSpacing: "0.03em" }}>
                            <span role="img" aria-label="lightning">⚡</span> {currentPlan.title || "VISUAL TARGET SEARCH"} {isCompleted ? "— COMPLETE" : ""}
                        </span>

                        {isRunning ? (
                            <button type="button" onClick={onAbort} style={abortBtnStyle} title="Cancel remaining actions">
                                <FaStop style={{ fontSize: "0.55rem" }} /> Cancel
                            </button>
                        ) : (
                            <span style={allDoneTagStyle}>
                                <FaCheckCircle style={{ fontSize: "0.65rem" }} /> All Done
                            </span>
                        )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {currentPlan.steps.map((step, idx) => {
                            const isDone = isCompleted || idx < activeStepIndex
                            const isActive = !isCompleted && idx === activeStepIndex

                            return (
                                <div
                                    key={idx}
                                    style={{
                                        ...stepRowStyle,
                                        borderLeft: `3px solid ${
                                            isActive
                                                ? "var(--c1-green)"
                                                : isDone
                                                ? "#38bdf8"
                                                : "rgba(100, 116, 139, 0.3)"
                                        }`,
                                        backgroundColor: isActive
                                            ? "rgba(50, 255, 126, 0.08)"
                                            : isDone
                                            ? "rgba(56, 189, 248, 0.04)"
                                            : "rgba(15, 23, 42, 0.4)",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        {isDone ? (
                                            <FaCheck style={{ color: "#38bdf8", fontSize: "0.68rem" }} />
                                        ) : isActive ? (
                                            <FaSpinner className="spin" style={{ color: "var(--c1-green)", fontSize: "0.68rem" }} />
                                        ) : (
                                            <span style={{
                                                width: 7,
                                                height: 7,
                                                borderRadius: "50%",
                                                border: "1px solid #64748b",
                                                display: "inline-block"
                                            }} />
                                        )}

                                        <span
                                            style={{
                                                fontSize: "0.7rem",
                                                fontWeight: isActive ? "bold" : "normal",
                                                color: isActive ? "var(--c1-green)" : isDone ? "#e2e8f0" : "#64748b",
                                            }}
                                        >
                                            {step.label || step.name || `Step ${idx + 1}`}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

const idleBoxStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "6px",
    backgroundColor: "rgba(10, 15, 25, 0.5)",
    border: "1px solid rgba(41, 128, 185, 0.25)",
    marginBottom: "8px",
}

const idleBadgeStyle = {
    fontSize: "0.6rem",
    fontWeight: "bold",
    color: "#64748b",
    letterSpacing: "0.05em",
    padding: "1px 6px",
    borderRadius: "4px",
    backgroundColor: "rgba(100, 116, 139, 0.15)",
}

const tpsBadgeStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "1px 6px",
    borderRadius: "10px",
    backgroundColor: "rgba(50, 255, 126, 0.15)",
    color: "var(--c1-green)",
    fontSize: "0.62rem",
    fontFamily: "monospace",
    fontWeight: "bold",
}

const completeBadgeStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "1px 6px",
    borderRadius: "10px",
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    color: "#38bdf8",
    fontSize: "0.62rem",
    fontWeight: "bold",
}

const allDoneTagStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    color: "#38bdf8",
    fontSize: "0.65rem",
    fontWeight: "bold",
}

const containerStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "10px",
}

const thoughtBoxStyle = {
    border: "1px solid rgba(41, 128, 185, 0.4)",
    borderRadius: "6px",
    backgroundColor: "rgba(10, 15, 25, 0.75)",
    overflow: "hidden",
}

const thoughtHeaderBtnStyle = {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 10px",
    background: "transparent",
    border: "none",
    color: "#cbd5e1",
    cursor: "pointer",
}

const thoughtContentStyle = {
    padding: "8px 10px",
    borderTop: "1px solid rgba(41, 128, 185, 0.2)",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
}

const planCardStyle = {
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid rgba(50, 255, 126, 0.35)",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.4)",
}

const stepRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: "4px",
}

const abortBtnStyle = {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "2px 6px",
    borderRadius: "4px",
    backgroundColor: "rgba(255, 33, 33, 0.15)",
    border: "1px solid var(--c6-red)",
    color: "var(--c6-red)",
    fontSize: "0.62rem",
    cursor: "pointer",
    fontWeight: "bold",
}

export default AiTaskStepper