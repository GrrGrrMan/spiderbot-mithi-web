// web-ui/src/components/console/CommandBrowser.js
import React, { useState } from "react"

// Structured command entry + one-tap system macros.
// Publishes to the global "hexapod/cmd" topic via publishImmediate.
const CommandBrowser = ({ publishImmediate, isAwake, onTogglePower }) => {
    const [cmdText, setCmdText] = useState("")

    const handleSendCmd = e => {
        e.preventDefault()
        if (!cmdText.trim()) return
        try {
            const parsedJson = JSON.parse(cmdText)
            console.log("[CommandBrowser] Manual Command Sent:", parsedJson)
            publishImmediate("hexapod/cmd", parsedJson)
            setCmdText("")
        } catch (err) {
            alert("Invalid JSON format!")
        }
    }

    const handleMacro = (type, payload) => {
        const fullPayload = { type, ...payload }
        console.log("[CommandBrowser] Macro Triggered:", fullPayload)
        publishImmediate("hexapod/cmd", fullPayload)
    }

    return (
        <div style={{ flex: 1, minWidth: "300px" }}>
            <form onSubmit={handleSendCmd} style={{ marginBottom: "15px" }}>
                <label
                    className="label"
                    htmlFor="cmdTextInput"
                    style={{ display: "block", marginBottom: "5px" }}
                >
                    Command Entry:
                </label>
                <div style={{ display: "flex", gap: "10px" }}>
                    <input
                        id="cmdTextInput"
                        type="text"
                        value={cmdText}
                        onChange={e => setCmdText(e.target.value)}
                        placeholder='e.g., {"type":"system","logging":true}'
                        style={{ flex: 1, margin: 0 }}
                    />
                    <button
                        type="submit"
                        className="button border"
                        style={{ padding: "0 15px", height: "2rem", cursor: "pointer" }}
                    >
                        Send
                    </button>
                </div>
            </form>

            <label className="label" style={{ display: "block", marginBottom: "5px" }}>
                System Macros:
            </label>
            <div className="grid-cols-2" style={{ gap: "8px" }}>
                <button
                    type="button"
                    className="button border"
                    onClick={() => handleMacro("system", { logging: true })}
                    style={{ padding: "8px", cursor: "pointer" }}
                >
                    Enable Logs
                </button>
                <button
                    type="button"
                    className="button border"
                    onClick={() => handleMacro("system", { logging: false })}
                    style={{ padding: "8px", cursor: "pointer" }}
                >
                    Disable Logs
                </button>

                <button
                    type="button"
                    className="button border"
                    onClick={onTogglePower}
                    style={{
                        padding: "8px",
                        cursor: "pointer",
                        backgroundColor: isAwake ? "var(--c0-dark-grey)" : "var(--c6-red)",
                        color: isAwake ? "var(--c2-pink)" : "var(--c0-dark-grey)",
                        borderColor: isAwake ? "var(--c4-blue)" : "var(--c6-red)",
                    }}
                >
                    {isAwake ? "Relax (Limp)" : "Wake (Torque)"}
                </button>

                <button
                    type="button"
                    className="button border"
                    onClick={() => handleMacro("system", { command: "reboot" })}
                    style={{ padding: "8px", cursor: "pointer" }}
                >
                    Reboot ESP32
                </button>
                <button
                    type="button"
                    className="button border"
                    onClick={() => publishImmediate("hexapod/cmd", { type: "ota", primary: true })}
                    style={{ padding: "8px", cursor: "pointer" }}
                >
                    Trigger OTA
                </button>
            </div>
        </div>
    )
}

export default CommandBrowser