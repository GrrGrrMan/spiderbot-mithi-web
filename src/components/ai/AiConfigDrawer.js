// web-ui/src/components/ai/AiConfigDrawer.js
import React, { useState } from "react"
import { FaSlidersH, FaDatabase, FaCheck } from "react-icons/fa"
import { useAiMemory } from "../../hooks/useAiMemory"
import { AiMemoryManager } from "./AiMemoryManager"
import { AiLlmConfigSection } from "./AiLlmConfigSection"

export const AiConfigDrawer = ({
    aiStatus,
    onUpdateConfig = () => {},
    isOpen,
    memoryState = null,
    publishAiMemory = () => {},
}) => {
    const [activeTab, setActiveTab] = useState("memory") // "memory" | "llm"
    const [notice, setNotice] = useState(null)

    const memory = useAiMemory({ memoryState, publishAiMemory, aiStatus })

    if (!isOpen) return null

    const handleNotify = (msg) => {
        setNotice(msg)
        setTimeout(() => setNotice(null), 2000)
    }

    const activeNotice = notice || memory.notice

    return (
        <div style={containerStyle} data-testid="ai-config-drawer">
            {/* Header & Sub-Tabs */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", gap: "4px" }}>
                    <button
                        type="button"
                        onClick={() => setActiveTab("memory")}
                        style={{
                            ...tabBtnStyle,
                            backgroundColor: activeTab === "memory" ? "rgba(56, 189, 248, 0.25)" : "transparent",
                            borderColor: activeTab === "memory" ? "#38bdf8" : "rgba(41, 128, 185, 0.4)",
                            color: activeTab === "memory" ? "#38bdf8" : "#94a3b8",
                        }}
                    >
                        <FaDatabase /> Memory Pool
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("llm")}
                        style={{
                            ...tabBtnStyle,
                            backgroundColor: activeTab === "llm" ? "rgba(50, 255, 126, 0.2)" : "transparent",
                            borderColor: activeTab === "llm" ? "var(--c1-green)" : "rgba(41, 128, 185, 0.4)",
                            color: activeTab === "llm" ? "var(--c1-green)" : "#94a3b8",
                        }}
                    >
                        <FaSlidersH /> LLM Params
                    </button>
                </div>

                {activeNotice && (
                    <span style={{ fontSize: "0.62rem", color: "var(--c1-green)", display: "flex", alignItems: "center", gap: "4px" }}>
                        <FaCheck /> {activeNotice}
                    </span>
                )}
            </div>

            {/* Modular Views */}
            {activeTab === "memory" ? (
                <AiMemoryManager memory={memory} />
            ) : (
                <AiLlmConfigSection aiStatus={aiStatus} onUpdateConfig={onUpdateConfig} onNotify={handleNotify} />
            )}
        </div>
    )
}

const containerStyle = {
    padding: "8px 10px",
    borderRadius: "8px",
    backgroundColor: "rgba(10, 15, 25, 0.96)",
    border: "1px solid rgba(50, 255, 126, 0.3)",
    marginBottom: "8px",
    maxHeight: "310px",
    overflowY: "auto",
}

const tabBtnStyle = {
    padding: "3px 8px",
    borderRadius: "4px",
    border: "1px solid",
    fontSize: "0.65rem",
    fontWeight: "bold",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
}

export default AiConfigDrawer