// web-ui/src/components/ai/AiConfigDrawer.js
import React, { useState, useEffect } from "react"
import { FaSlidersH, FaCheck } from "react-icons/fa"

const THINKING_LEVELS = [
    { id: "off", label: "Off", desc: "0 tokens (fast reflex)" },
    { id: "low", label: "Low", desc: "1k tokens (basic steps)" },
    { id: "medium", label: "Med", desc: "4k tokens (spatial vision)" },
    { id: "high", label: "High", desc: "8k tokens (deep reasoning)" },
]

const PERSONALITY_MODES = ["friendly", "concise", "curious", "guard"]

export const AiConfigDrawer = ({ aiStatus, onUpdateConfig, isOpen }) => {
    const llm = aiStatus?.llm || {}

    const [model, setModel] = useState(llm.model || "hexapod-vision")
    const [visionModel, setVisionModel] = useState(llm.vision_model || "hexapod-vision")
    const [thinkingLevel, setThinkingLevel] = useState(llm.thinking_level || "off")
    const [personality, setPersonality] = useState(llm.personality || "friendly")
    const [temperature, setTemperature] = useState(llm.temperature ?? 0.3)
    const [customInstructions, setCustomInstructions] = useState(llm.custom_instructions || "")
    const [savedNotice, setSavedNotice] = useState(false)

    // Sync from incoming MQTT heartbeat
    useEffect(() => {
        if (llm.model) setModel(llm.model)
        if (llm.vision_model) setVisionModel(llm.vision_model)
        if (llm.thinking_level) setThinkingLevel(llm.thinking_level)
        if (llm.personality) setPersonality(llm.personality)
        if (llm.temperature !== undefined) setTemperature(llm.temperature)
        if (llm.custom_instructions !== undefined) setCustomInstructions(llm.custom_instructions)
    }, [llm.model, llm.vision_model, llm.thinking_level, llm.personality, llm.temperature, llm.custom_instructions])

    if (!isOpen) return null

    const handleApply = () => {
        onUpdateConfig({
            model: model.trim(),
            vision_model: visionModel.trim(),
            thinking_level: thinkingLevel,
            personality: personality,
            temperature: parseFloat(temperature),
            custom_instructions: customInstructions.trim(),
        })
        setSavedNotice(true)
        setTimeout(() => setSavedNotice(false), 2000)
    }

    return (
        <div style={containerStyle} data-testid="ai-config-drawer">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: "bold", color: "var(--c1-green)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FaSlidersH /> LLM RUNTIME PARAMETERS
                </span>
                {savedNotice && (
                    <span style={{ fontSize: "0.65rem", color: "var(--c1-green)", display: "flex", alignItems: "center", gap: "4px" }}>
                        <FaCheck /> Synced to Pi!
                    </span>
                )}
            </div>

            {/* 1. Reasoning / Thinking Effort Level */}
            <div style={sectionStyle}>
                <label style={labelStyle}>THINKING BUDGET (REASONING EFFORT):</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }}>
                    {THINKING_LEVELS.map(t => {
                        const active = thinkingLevel === t.id
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                    setThinkingLevel(t.id)
                                    onUpdateConfig({ thinking_level: t.id })
                                }}
                                style={{
                                    ...pillBtnStyle,
                                    backgroundColor: active ? "rgba(50, 255, 126, 0.2)" : "rgba(23, 33, 43, 0.8)",
                                    borderColor: active ? "var(--c1-green)" : "rgba(41, 128, 185, 0.4)",
                                    color: active ? "var(--c1-green)" : "#94a3b8",
                                }}
                                title={t.desc}
                            >
                                {t.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* 2. Personality Presets */}
            <div style={sectionStyle}>
                <label style={labelStyle}>PERSONALITY MODE:</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }}>
                    {PERSONALITY_MODES.map(p => {
                        const active = personality === p
                        return (
                            <button
                                key={p}
                                type="button"
                                onClick={() => {
                                    setPersonality(p)
                                    onUpdateConfig({ personality: p })
                                }}
                                style={{
                                    ...pillBtnStyle,
                                    backgroundColor: active ? "rgba(41, 128, 185, 0.3)" : "rgba(23, 33, 43, 0.8)",
                                    borderColor: active ? "var(--c4-blue)" : "rgba(41, 128, 185, 0.4)",
                                    color: active ? "#60a5fa" : "#94a3b8",
                                    textTransform: "capitalize",
                                }}
                            >
                                {p}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* 3. Model & Vision Model Overrides */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                <div>
                    <label style={labelStyle}>CHAT MODEL:</label>
                    <input
                        type="text"
                        value={model}
                        onChange={e => setModel(e.target.value)}
                        style={inputStyle}
                        placeholder="e.g. hexapod-vision"
                    />
                </div>
                <div>
                    <label style={labelStyle}>VISION MODEL:</label>
                    <input
                        type="text"
                        value={visionModel}
                        onChange={e => setVisionModel(e.target.value)}
                        style={inputStyle}
                        placeholder="e.g. hexapod-vision"
                    />
                </div>
            </div>

            {/* 4. Temperature Slider */}
            <div style={sectionStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <label style={labelStyle}>TEMPERATURE (CREATIVITY):</label>
                    <span style={{ fontSize: "0.65rem", color: "var(--c1-green)", fontFamily: "monospace" }}>{temperature.toFixed(2)}</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={temperature}
                    onChange={e => setTemperature(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "var(--c1-green)", cursor: "pointer", height: "4px" }}
                />
            </div>

            {/* 5. Custom System Instructions */}
            <div style={sectionStyle}>
                <label style={labelStyle}>CUSTOM SYSTEM PROMPT INJECTION:</label>
                <textarea
                    rows={2}
                    value={customInstructions}
                    onChange={e => setCustomInstructions(e.target.value)}
                    placeholder="e.g. 'Speak like JARVIS. When walking forward, confirm step stability.'"
                    style={textareaStyle}
                />
            </div>

            <button type="button" onClick={handleApply} style={applyBtnStyle}>
                Apply & Save Parameters
            </button>
        </div>
    )
}

const containerStyle = {
    padding: "10px",
    borderRadius: "8px",
    backgroundColor: "rgba(10, 15, 25, 0.95)",
    border: "1px solid rgba(50, 255, 126, 0.3)",
    marginBottom: "10px",
}

const sectionStyle = {
    marginBottom: "8px",
}

const labelStyle = {
    fontSize: "0.62rem",
    fontWeight: "bold",
    color: "#94a3b8",
    display: "block",
    marginBottom: "4px",
    letterSpacing: "0.04em",
}

const pillBtnStyle = {
    padding: "4px 6px",
    borderRadius: "4px",
    border: "1px solid",
    fontSize: "0.65rem",
    cursor: "pointer",
    fontWeight: "bold",
}

const inputStyle = {
    width: "100%",
    padding: "4px 8px",
    borderRadius: "4px",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    border: "1px solid rgba(41, 128, 185, 0.4)",
    color: "#fff",
    fontSize: "0.65rem",
    height: "1.8rem",
}

const textareaStyle = {
    width: "100%",
    padding: "4px 8px",
    borderRadius: "4px",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    border: "1px solid rgba(41, 128, 185, 0.4)",
    color: "#cbd5e1",
    fontSize: "0.65rem",
    fontFamily: "monospace",
    resize: "vertical",
}

const applyBtnStyle = {
    width: "100%",
    padding: "6px",
    borderRadius: "4px",
    backgroundColor: "var(--c4-blue)",
    border: "none",
    color: "#fff",
    fontSize: "0.7rem",
    fontWeight: "bold",
    cursor: "pointer",
}

export default AiConfigDrawer