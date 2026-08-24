// web-ui/src/components/ai/AiLlmConfigSection.js
import React, { useState, useEffect } from "react"

export const AiLlmConfigSection = ({ aiStatus, onUpdateConfig, onNotify }) => {
    const llm = aiStatus?.llm || {}

    const thinkingLevels = llm.available_thinking_levels || [
        { id: "off", label: "Off" },
        { id: "low", label: "Low" },
        { id: "medium", label: "Med" },
        { id: "high", label: "High" },
    ]

    const personalityModes = llm.available_personalities || [
        { id: "friendly", label: "Friendly" },
        { id: "concise", label: "Concise" },
        { id: "curious", label: "Curious" },
        { id: "guard", label: "Guard" },
    ]

    const [model, setModel] = useState(llm.model || "hexapod-vision")
    const [visionModel, setVisionModel] = useState(llm.vision_model || "hexapod-vision")
    const [thinkingLevel, setThinkingLevel] = useState(llm.thinking_level || "off")
    const [personality, setPersonality] = useState(llm.personality || "friendly")
    const [temperature, setTemperature] = useState(llm.temperature ?? 0.3)
    const [customInstructions, setCustomInstructions] = useState(llm.custom_instructions || "")

    useEffect(() => {
        if (llm.model) setModel(llm.model)
        if (llm.vision_model) setVisionModel(llm.vision_model)
        if (llm.thinking_level) setThinkingLevel(llm.thinking_level)
        if (llm.personality) setPersonality(llm.personality)
        if (llm.temperature !== undefined) setTemperature(llm.temperature)
        if (llm.custom_instructions !== undefined) setCustomInstructions(llm.custom_instructions)
    }, [llm.model, llm.vision_model, llm.thinking_level, llm.personality, llm.temperature, llm.custom_instructions])

    const handleApply = () => {
        onUpdateConfig({
            model: model.trim(),
            vision_model: visionModel.trim(),
            thinking_level: thinkingLevel,
            personality: personality,
            temperature: parseFloat(temperature),
            custom_instructions: customInstructions.trim(),
        })
        if (onNotify) onNotify("LLM params saved!")
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {/* Thinking Budget */}
            <div>
                <span style={labelStyle}>THINKING BUDGET:</span>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${thinkingLevels.length || 4}, 1fr)`, gap: "3px" }}>
                    {thinkingLevels.map(t => {
                        const id = typeof t === "string" ? t : t.id
                        const label = typeof t === "string" ? t : t.label
                        const active = thinkingLevel === id
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => {
                                    setThinkingLevel(id)
                                    onUpdateConfig({ thinking_level: id })
                                }}
                                style={{
                                    ...pillBtnStyle,
                                    backgroundColor: active ? "rgba(50, 255, 126, 0.2)" : "rgba(23, 33, 43, 0.8)",
                                    borderColor: active ? "var(--c1-green)" : "rgba(41, 128, 185, 0.4)",
                                    color: active ? "var(--c1-green)" : "#94a3b8",
                                    padding: "3px 4px",
                                }}
                            >
                                {label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Personality Mode */}
            <div>
                <span style={labelStyle}>PERSONALITY MODE:</span>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${personalityModes.length || 4}, 1fr)`, gap: "3px" }}>
                    {personalityModes.map(p => {
                        const id = typeof p === "string" ? p : p.id
                        const label = typeof p === "string" ? p : p.label
                        const active = personality === id
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => {
                                    setPersonality(id)
                                    onUpdateConfig({ personality: id })
                                }}
                                style={{
                                    ...pillBtnStyle,
                                    backgroundColor: active ? "rgba(41, 128, 185, 0.3)" : "rgba(23, 33, 43, 0.8)",
                                    borderColor: active ? "var(--c4-blue)" : "rgba(41, 128, 185, 0.4)",
                                    color: active ? "#60a5fa" : "#94a3b8",
                                    textTransform: "capitalize",
                                    padding: "3px 4px",
                                }}
                            >
                                {label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Model Inputs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div>
                    <span style={labelStyle}>CHAT MODEL:</span>
                    <input type="text" value={model} onChange={e => setModel(e.target.value)} style={inputStyle} />
                </div>
                <div>
                    <span style={labelStyle}>VISION MODEL:</span>
                    <input type="text" value={visionModel} onChange={e => setVisionModel(e.target.value)} style={inputStyle} />
                </div>
            </div>

            {/* Temperature Slider */}
            <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={labelStyle}>TEMPERATURE:</span>
                    <span style={{ fontSize: "0.62rem", color: "var(--c1-green)", fontFamily: "monospace" }}>{temperature.toFixed(2)}</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={temperature}
                    onChange={e => setTemperature(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "var(--c1-green)", cursor: "pointer", height: "3px" }}
                />
            </div>

            {/* Custom Prompt */}
            <div>
                <span style={labelStyle}>CUSTOM SYSTEM PROMPT:</span>
                <textarea
                    rows={2}
                    value={customInstructions}
                    onChange={e => setCustomInstructions(e.target.value)}
                    placeholder="e.g. 'Speak concisely. Verify stance stability.'"
                    style={textareaStyle}
                />
            </div>

            <button type="button" onClick={handleApply} style={applyBtnStyle}>
                Apply & Save Parameters
            </button>
        </div>
    )
}

const labelStyle = { fontSize: "0.6rem", fontWeight: "bold", color: "#94a3b8", display: "block", marginBottom: "2px" }
const pillBtnStyle = { borderRadius: "4px", border: "1px solid", fontSize: "0.63rem", cursor: "pointer", fontWeight: "bold" }
const inputStyle = { width: "100%", padding: "3px 6px", borderRadius: "4px", backgroundColor: "rgba(0, 0, 0, 0.5)", border: "1px solid rgba(41, 128, 185, 0.4)", color: "#fff", fontSize: "0.65rem", height: "1.6rem", boxSizing: "border-box" }
const textareaStyle = { width: "100%", padding: "3px 6px", borderRadius: "4px", backgroundColor: "rgba(0, 0, 0, 0.5)", border: "1px solid rgba(41, 128, 185, 0.4)", color: "#cbd5e1", fontSize: "0.65rem", fontFamily: "monospace", resize: "none", height: "2.3rem", boxSizing: "border-box" }
const applyBtnStyle = { width: "100%", padding: "4px", borderRadius: "4px", backgroundColor: "var(--c4-blue)", border: "none", color: "#fff", fontSize: "0.66rem", fontWeight: "bold", cursor: "pointer", marginTop: "2px" }

export default AiLlmConfigSection