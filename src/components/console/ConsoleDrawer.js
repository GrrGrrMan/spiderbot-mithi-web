// web-ui/src/components/console/ConsoleDrawer.js
import React, { useState } from "react"
import CommandBrowser from "./CommandBrowser"
import LogFeed from "./LogFeed"

// Console container: header + collapse state + telemetry-derived power.
// Composed of CommandBrowser (commands/macros) and LogFeed (log terminal).
const ConsoleDrawer = ({ isConnected, logs, publishImmediate, clearLogs, telemetry }) => {
    const [isExpanded, setIsExpanded] = useState(true)
    const [localIsAwake, setLocalIsAwake] = useState(true)

    // Derive active power state from live telemetry or local state
    const isAwake =
        telemetry && telemetry.power !== undefined ? telemetry.power : localIsAwake

    const handlePowerToggle = () => {
        const newState = !isAwake
        setLocalIsAwake(newState)
        console.log("[ConsoleDrawer] Power Toggle:", { type: "system", power: newState })
        publishImmediate("hexapod/cmd", { type: "system", power: newState })
    }

    return (
        <div
            className="border"
            style={{
                margin: "10px",
                padding: "10px",
                marginTop: "15px",
                position: "relative",
                zIndex: 10,
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>CONSOLE & SYSTEM COMMANDS</h3>
                <button
                    type="button"
                    className="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    style={{
                        padding: "2px 10px",
                        border: "1px solid var(--c4-blue)",
                        borderRadius: "5px",
                        cursor: "pointer",
                    }}
                >
                    {isExpanded ? "Collapse ▲" : "Expand ▼"}
                </button>
            </div>

            {isExpanded && (
                <div style={{ display: "flex", gap: "15px", marginTop: "10px", flexWrap: "wrap" }}>
                    <CommandBrowser
                        publishImmediate={publishImmediate}
                        isAwake={isAwake}
                        onTogglePower={handlePowerToggle}
                    />
                    <LogFeed logs={logs} clearLogs={clearLogs} />
                </div>
            )}
        </div>
    )
}

export default ConsoleDrawer