// web-ui/src/components/ai/AiMemoryManager.js
import React, { useState } from "react"
import { FaTrash, FaPlus, FaBolt, FaBroom, FaExclamationTriangle } from "react-icons/fa"

const MEMORY_MODES = [
    { id: "ephemeral", label: "Ephemeral", desc: "1-Turn reflex. Zero conversational history stored." },
    { id: "session", label: "Session", desc: "Working buffer. 16-turn RAM history, 15m idle reset." },
    { id: "persistent", label: "Persistent", desc: "Working session + permanent learned facts pool." },
]

export const AiMemoryManager = ({ memory }) => {
    const { mode, turnsCount, memoryPool, setMode, setFact, deleteFact, clearSession, wipeAll } = memory
    const [newKey, setNewKey] = useState("")
    const [newValue, setNewValue] = useState("")

    const poolKeys = Object.keys(memoryPool || {})

    const handleAdd = (e) => {
        e.preventDefault()
        if (!newKey.trim() || !newValue.trim()) return
        setFact(newKey, newValue)
        setNewKey("")
        setNewValue("")
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {/* 1. Retention Mode Selector */}
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={labelStyle}>RETENTION TIER:</span>
                    <span style={{ fontSize: "0.6rem", color: "#38bdf8", fontWeight: "bold", textTransform: "uppercase" }}>
                        {mode}
                    </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
                    {MEMORY_MODES.map(m => {
                        const isActive = mode === m.id
                        return (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => setMode(m.id)}
                                title={m.desc}
                                style={{
                                    ...pillBtnStyle,
                                    backgroundColor: isActive ? "rgba(56, 189, 248, 0.25)" : "rgba(23, 33, 43, 0.8)",
                                    borderColor: isActive ? "#38bdf8" : "rgba(41, 128, 185, 0.4)",
                                    color: isActive ? "#38bdf8" : "#94a3b8",
                                    padding: "5px 2px",
                                }}
                            >
                                {m.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* 2. Working Session Turns */}
            <div style={sessionBoxStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.66rem" }}>
                    <FaBolt style={{ color: turnsCount > 0 ? "var(--c1-green)" : "#64748b" }} />
                    <span style={{ color: "#cbd5e1" }}>
                        Session Buffer: <strong style={{ color: turnsCount > 0 ? "var(--c1-green)" : "#94a3b8" }}>{turnsCount} turns</strong>
                    </span>
                </div>
                <button type="button" onClick={clearSession} style={actionBtnStyle} title="Clear temporary session turns">
                    <FaBroom style={{ fontSize: "0.55rem" }} /> Clear
                </button>
            </div>

            {/* 3. Persistent Key-Value Pool Inspector */}
            <div>
                <span style={{ ...labelStyle, marginBottom: "3px" }}>PERSISTENT POOL ({poolKeys.length} facts):</span>
                <div style={poolListStyle}>
                    {poolKeys.length === 0 ? (
                        <div style={{ fontSize: "0.62rem", color: "#64748b", textAlign: "center", padding: "6px" }}>
                            No persistent facts stored yet.
                        </div>
                    ) : (
                        poolKeys.map(k => (
                            <div key={k} style={rowStyle}>
                                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    <span style={{ color: "var(--c1-green)", fontFamily: "monospace", fontWeight: "bold" }}>{k}: </span>
                                    <span style={{ color: "#e2e8f0" }}>{String(memoryPool[k])}</span>
                                </div>
                                <button type="button" onClick={() => deleteFact(k)} style={delBtnStyle} title={`Delete ${k}`}>
                                    <FaTrash style={{ fontSize: "0.55rem" }} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Add Fact Form */}
                <form onSubmit={handleAdd} style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    <input
                        type="text"
                        placeholder="Key"
                        value={newKey}
                        onChange={e => setNewKey(e.target.value)}
                        style={{ ...inputStyle, flex: 1, margin: 0, height: "1.6rem" }}
                    />
                    <input
                        type="text"
                        placeholder="Value"
                        value={newValue}
                        onChange={e => setNewValue(e.target.value)}
                        style={{ ...inputStyle, flex: 1, margin: 0, height: "1.6rem" }}
                    />
                    <button type="submit" style={addBtnStyle} disabled={!newKey.trim() || !newValue.trim()}>
                        <FaPlus style={{ fontSize: "0.55rem" }} /> Add
                    </button>
                </form>
            </div>

            {/* 4. Factory Reset Wipe */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "2px" }}>
                <button type="button" onClick={wipeAll} style={wipeBtnStyle} title="Wipe session turns and persistent facts">
                    <FaExclamationTriangle style={{ fontSize: "0.55rem" }} /> Wipe All Memory
                </button>
            </div>
        </div>
    )
}

const labelStyle = { fontSize: "0.6rem", fontWeight: "bold", color: "#94a3b8", display: "block" }
const pillBtnStyle = { borderRadius: "4px", border: "1px solid", fontSize: "0.63rem", cursor: "pointer", fontWeight: "bold", textAlign: "center" }
const sessionBoxStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", borderRadius: "5px", backgroundColor: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(41, 128, 185, 0.3)" }
const poolListStyle = { maxHeight: "80px", overflowY: "auto", backgroundColor: "rgba(0, 0, 0, 0.45)", border: "1px solid rgba(41, 128, 185, 0.3)", borderRadius: "4px", padding: "3px", marginBottom: "5px" }
const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 5px", borderRadius: "3px", backgroundColor: "rgba(15, 23, 42, 0.6)", marginBottom: "2px", fontSize: "0.64rem" }
const inputStyle = { padding: "3px 6px", borderRadius: "4px", backgroundColor: "rgba(0, 0, 0, 0.5)", border: "1px solid rgba(41, 128, 185, 0.4)", color: "#fff", fontSize: "0.65rem", boxSizing: "border-box" }
const actionBtnStyle = { display: "inline-flex", alignItems: "center", gap: "3px", padding: "2px 6px", borderRadius: "4px", backgroundColor: "rgba(41, 128, 185, 0.25)", border: "1px solid rgba(41, 128, 185, 0.5)", color: "#38bdf8", fontSize: "0.6rem", fontWeight: "bold", cursor: "pointer" }
const addBtnStyle = { display: "inline-flex", alignItems: "center", gap: "3px", padding: "0 8px", height: "1.6rem", borderRadius: "4px", backgroundColor: "rgba(50, 255, 126, 0.2)", border: "1px solid var(--c1-green)", color: "var(--c1-green)", fontSize: "0.62rem", fontWeight: "bold", cursor: "pointer" }
const delBtnStyle = { background: "transparent", border: "none", color: "var(--c6-red)", cursor: "pointer", padding: "1px 3px" }
const wipeBtnStyle = { display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "4px", backgroundColor: "rgba(255, 33, 33, 0.12)", border: "1px solid var(--c6-red)", color: "var(--c6-red)", fontSize: "0.6rem", fontWeight: "bold", cursor: "pointer" }

export default AiMemoryManager