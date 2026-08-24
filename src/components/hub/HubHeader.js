// FILE: src/components/hub/HubHeader.js
import React from "react"
import { FaBars, FaChevronDown, FaCheck, FaMinus, FaTimes } from "react-icons/fa"

export const HubHeader = ({
    tabConfig,
    activeTab,
    onSelectTab,
    isMenuOpen,
    setIsMenuOpen,
    isDragging,
    activeExecutingAction,
    onClear,
    isMinimized,
    onToggleMinimize,
    onClose,
    telemetry,
    isAwake,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
}) => {
    const activeConfig = tabConfig.find(t => t.id === activeTab) || tabConfig[0]
    const TabIcon = activeConfig.icon

    return (
        <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onLostPointerCapture={onPointerCancel}
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid rgba(41, 128, 185, 0.4)",
                paddingBottom: "8px",
                cursor: isDragging ? "grabbing" : "grab",
                userSelect: "none",
                touchAction: "none",
                flexShrink: 0,
            }}
        >

            {/* 3-Dashes Menu Dropdown */}
            <div style={{ position: "relative" }}>
                <button
                    type="button"
                    onClick={e => {
                        e.stopPropagation()
                        setIsMenuOpen(prev => !prev)
                    }}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        background: isMenuOpen ? "rgba(41, 128, 185, 0.3)" : "rgba(23, 33, 43, 0.85)",
                        border: `1px solid ${isMenuOpen ? "var(--c1-green)" : "rgba(41, 128, 185, 0.5)"}`,
                        color: "#f8fafc",
                        borderRadius: "6px",
                        padding: "4px 8px",
                        cursor: "pointer",
                    }}
                >
                    <FaBars style={{ fontSize: "0.85rem" }} />
                    <TabIcon style={{ color: activeConfig.color, fontSize: "0.95rem" }} />
                    <span style={{ fontSize: "0.78rem", fontWeight: "bold", color: "#f8fafc" }}>
                        {activeConfig.label.toUpperCase()}
                    </span>
                    <FaChevronDown style={{ fontSize: "0.6rem", opacity: 0.7, transform: isMenuOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </button>

                {/* Dropdown Menu Popup */}
                {isMenuOpen && (
                    <div className="no-drag" style={dropdownStyle} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: "6px 10px", fontSize: "0.65rem", fontWeight: "bold", color: "#64748b", borderBottom: "1px solid rgba(41, 128, 185, 0.3)" }}>
                            SELECT HUB VIEW
                        </div>
                        {tabConfig.map(tab => {
                            const Icon = tab.icon
                            const isSelected = activeTab === tab.id
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => {
                                        onSelectTab(tab.id)
                                        setIsMenuOpen(false)
                                    }}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "8px 10px",
                                        background: isSelected ? "rgba(50, 255, 126, 0.12)" : "transparent",
                                        color: isSelected ? "var(--c1-green)" : "#cbd5e1",
                                        border: "none",
                                        borderBottom: "1px solid rgba(41, 128, 185, 0.15)",
                                        cursor: "pointer",
                                        fontSize: "0.75rem",
                                        textAlign: "left",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <Icon style={{ color: tab.color, fontSize: "0.9rem" }} />
                                        <span style={{ fontWeight: isSelected ? "bold" : "normal" }}>{tab.label}</span>
                                    </div>
                                    {isSelected && <FaCheck style={{ color: "var(--c1-green)", fontSize: "0.7rem" }} />}
                                </button>
                            )
                        })}

                        {telemetry && (
                            <div style={{ padding: "8px 10px", borderTop: "1px solid rgba(41, 128, 185, 0.3)", fontSize: "0.65rem", color: "#94a3b8", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                                <div>IP: {telemetry.ip || "N/A"}</div>
                                <div>RSSI: {telemetry.rssi ? `${telemetry.rssi} dBm` : "N/A"}</div>
                                <div>Heap: {telemetry.free_heap ? `${(telemetry.free_heap / 1024).toFixed(1)} KB` : "N/A"}</div>
                                <div>Power: {isAwake ? "Torque" : "Limp"}</div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Window Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }} onPointerDown={e => e.stopPropagation()}>
                {activeExecutingAction && (
                    <span style={badgeStyle} title="Active action running">
                        {activeExecutingAction}
                    </span>
                )}
                <button type="button" onClick={onClear} style={controlBtnStyle} title="Clear content">
                    Clear
                </button>
                <button type="button" onClick={onToggleMinimize} style={controlBtnStyle} title={isMinimized ? "Expand" : "Minimize"}>
                    <FaMinus style={{ fontSize: "0.55rem" }} />
                </button>
                <button type="button" onClick={onClose} style={{ ...controlBtnStyle, borderColor: "var(--c6-red)", color: "var(--c6-red)" }} title="Close">
                    <FaTimes style={{ fontSize: "0.65rem" }} />
                </button>
            </div>
        </div>
    )
}

const dropdownStyle = {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: "0px",
    width: "230px",
    backgroundColor: "rgba(15, 23, 42, 0.98)",
    border: "1px solid var(--c4-blue)",
    borderRadius: "8px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.8), 0 0 12px rgba(41, 128, 185, 0.4)",
    zIndex: 100,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backdropFilter: "blur(12px)",
}

const badgeStyle = {
    fontSize: "0.62rem",
    padding: "2px 6px",
    borderRadius: "8px",
    background: "rgba(252, 66, 123, 0.2)",
    border: "1px solid var(--c2-pink)",
    color: "var(--c2-pink)",
    fontWeight: "bold",
}

const controlBtnStyle = {
    background: "rgba(23, 33, 43, 0.85)",
    border: "1px solid rgba(41, 128, 185, 0.5)",
    color: "#cbd5e1",
    borderRadius: "4px",
    padding: "3px 7px",
    fontSize: "0.68rem",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
}