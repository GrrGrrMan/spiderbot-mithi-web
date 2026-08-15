// web-ui/src/components/console/LogFeed.js
import React, { useEffect, useRef } from "react"

// Styled remote log terminal with auto-scroll and a clear action.
// Unmounts/remounts with the console body, so the effect runs on open.
const LogFeed = ({ logs, clearLogs }) => {
    const terminalRef = useRef(null)

    const scrollToBottom = () => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight
        }
    }

    useEffect(scrollToBottom, [logs])

    return (
        <div style={{ flex: 2, minWidth: "400px" }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "5px",
                }}
            >
                <label className="label" style={{ margin: 0, width: "auto" }}>
                    Remote System Log Output:
                </label>
                <button
                    type="button"
                    className="button"
                    onClick={clearLogs}
                    style={{
                        padding: "2px 8px",
                        border: "1px solid var(--c4-blue)",
                        borderRadius: "4px",
                        fontSize: "0.65rem",
                        cursor: "pointer",
                    }}
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
                    border: "1px solid var(--c4-blue)",
                }}
            >
                {logs.length === 0 ? (
                    <span style={{ opacity: 0.5 }}>
                        Waiting for system logs... Click "Enable Logs" macro above.
                    </span>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} style={{ whiteSpace: "pre-wrap", marginBottom: "4px" }}>
                            {log}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export default LogFeed