// web-ui/src/components/hub/HubSystemView.js
import React from "react"
import CommandBrowser from "../console/CommandBrowser"
import LogFeed from "../console/LogFeed"

export const HubSystemView = ({ publishImmediate, isAwake, onTogglePower, logs, clearLogs }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ padding: "4px" }}>
            <CommandBrowser publishImmediate={publishImmediate} isAwake={isAwake} onTogglePower={onTogglePower} />
        </div>
        <div style={{ borderTop: "1px solid rgba(41, 128, 185, 0.3)", paddingTop: "8px" }}>
            <LogFeed logs={logs} clearLogs={clearLogs} />
        </div>
    </div>
)