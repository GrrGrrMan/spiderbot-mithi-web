import React, { useState, useEffect, useRef } from "react"

const ConsoleDrawer = ({ isConnected, logs, publishImmediate }) => {
    const [isExpanded, setIsExpanded] = useState(true)
    const [cmdText, setCmdText] = useState("")
    const [isAwake, setIsAwake] = useState(true)
    const [logOffset, setLogOffset] = useState(0)
    const terminalRef = useRef(null)

    // Auto-scroll ONLY the inner log terminal container without moving the browser page
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight
        }
    }, [logs, isExpanded])

    const handleSendCmd = (e) => {
        e.preventDefault()
        if (!cmdText.trim()) return
        try {
            const parsedJson = JSON.parse(cmdText)
            console.log("[ConsoleDrawer] Manual Command Sent:", parsedJson)
            publishImmediate("hexapod/cmd", parsedJson)
            setCmdText("")
        } catch (err) {
            alert("Invalid JSON format!")
        }
    }

    const handleMacro = (type, payload) => {
        const fullPayload = { type, ...payload }
        console.log("[ConsoleDrawer] Macro Triggered:", fullPayload)
        publishImmediate("hexapod/cmd", fullPayload)
    }

    const handlePowerToggle = () => {
        const newState = !isAwake
        setIsAwake(newState)
        handleMacro("system", { power: newState })
    }

    const visibleLogs = logs.slice(logOffset)

    return (
        <div 
            className="border" 
            style={{ 
                margin: "10px", 
                padding: "10px", 
                marginTop: "15px",
                position: "relative",
                zIndex: 10
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>CONSOLE & SYSTEM COMMANDS</h3>
                <button 
                    type="button"
                    className="button" 
                    onClick={() => setIsExpanded(!isExpanded)}
                    style={{ padding: "2px 10px", border: "1px solid var(--c4-blue)", borderRadius: "5px", cursor: "pointer" }}
                >
                    {isExpanded ? "Collapse ▲" : "Expand ▼"}
                </button>
            </div>

            {isExpanded && (
                <div style={{ display: "flex", gap: "15px", marginTop: "10px", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: "300px" }}>
                        <form onSubmit={handleSendCmd} style={{ marginBottom: "15px" }}>
                            <label className="label" style={{ display: "block", marginBottom: "5px" }}>
                                Command Entry:
                            </label>
                            <div style={{ display: "flex", gap: "10px" }}>
                                <input 
                                    type="text" 
                                    value={cmdText} 
                                    onChange={(e) => setCmdText(e.target.value)}
                                    placeholder='e.g., {"type":"system","logging":true}'
                                    style={{ flex: 1, margin: 0 }}
                                />
                                <button type="submit" className="button border" style={{ padding: "0 15px", height: "2rem", cursor: "pointer" }}>
                                    Send
                                </button>
                            </div>
                        </form>

                        <label className="label" style={{ display: "block", marginBottom: "5px" }}>
                            System Macros:
                        </label>
                        <div className="grid-cols-2" style={{ gap: "8px" }}>
                            <button type="button" className="button border" onClick={() => handleMacro("system", { logging: true })} style={{ padding: "8px", cursor: "pointer" }}>
                                Enable Logs
                            </button>
                            <button type="button" className="button border" onClick={() => handleMacro("system", { logging: false })} style={{ padding: "8px", cursor: "pointer" }}>
                                Disable Logs
                            </button>
                            
                            <button 
                                type="button" 
                                className="button border" 
                                onClick={handlePowerToggle} 
                                style={{ 
                                    padding: "8px", 
                                    cursor: "pointer",
                                    backgroundColor: isAwake ? "var(--c0-dark-grey)" : "var(--c6-red)",
                                    color: isAwake ? "var(--c2-pink)" : "var(--c0-dark-grey)",
                                    borderColor: isAwake ? "var(--c4-blue)" : "var(--c6-red)"
                                }}
                            >
                                {isAwake ? "Relax (Limp)" : "Wake (Torque)"}
                            </button>

                            <button type="button" className="button border" onClick={() => handleMacro("system", { command: "reboot" })} style={{ padding: "8px", cursor: "pointer" }}>
                                Reboot ESP32
                            </button>
                            <button type="button" className="button border" onClick={() => publishImmediate("hexapod/cmd", { type: "ota", primary: true })} style={{ padding: "8px", cursor: "pointer" }}>
                                Trigger OTA
                            </button>
                        </div>
                    </div>

                    <div style={{ flex: 2, minWidth: "400px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                            <label className="label" style={{ margin: 0, width: "auto" }}>
                                Remote System Log Output:
                            </label>
                            <button 
                                type="button" 
                                className="button" 
                                onClick={() => setLogOffset(logs.length)}
                                style={{ padding: "2px 8px", border: "1px solid var(--c4-blue)", borderRadius: "4px", fontSize: "0.65rem", cursor: "pointer" }}
                            >
                                Clear Terminal
                            </button>
                        </div>
                        <div 
                            ref={terminalRef}
                            style={{ 
                                backgroundColor: "black", 
                                color: "var(--c1-green)", 
                                fontFamily: "monospace", 
                                fontSize: "0.65rem",
                                height: "150px", 
                                overflowY: "scroll", 
                                padding: "10px",
                                borderRadius: "10px",
                                border: "1px solid var(--c4-blue)"
                            }}
                        >
                            {visibleLogs.length === 0 ? (
                                <span style={{ opacity: 0.5 }}>Waiting for system logs... Click "Enable Logs" macro above.</span>
                            ) : (
                                visibleLogs.map((log, i) => (
                                    <div key={i} style={{ whiteSpace: "pre-wrap", marginBottom: "4px" }}>
                                        {log}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ConsoleDrawer