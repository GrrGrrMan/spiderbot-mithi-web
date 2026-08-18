// web-ui/src/components/viewport/ViewportToggle.js
import React from "react"
import { FaCube, FaVideo } from "react-icons/fa"

const TABS = [
    { id: "sim", label: "SIM", icon: FaCube, title: "3D simulator view" },
    { id: "cam", label: "CAM", icon: FaVideo, title: "Live MJPEG camera view" },
]

const indicatorTransform = activeId =>
    activeId === "cam" ? "translateX(100%)" : "translateX(0%)"

const ViewportToggle = ({ activeView, onChange }) => {
    const wrapperStyle = {
        position: "absolute",
        top: "8px",
        right: "8px",
        zIndex: 5,
        display: "flex",
        alignItems: "stretch",
        width: "108px",
        height: "28px",
        padding: "2px",
        borderRadius: "14px",
        background: "rgba(0, 0, 0, 0.55)",
        border: "1px solid var(--c3-border, #333)",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.4)",
        userSelect: "none",
    }

    const indicatorStyle = {
        position: "absolute",
        top: "2px",
        left: "2px",
        width: "calc(50% - 2px)",
        height: "calc(100% - 4px)",
        borderRadius: "12px",
        background: "var(--c1-green, #2ecc71)",
        boxShadow: "0 0 8px var(--c1-green, #2ecc71)",
        transition: "transform 220ms cubic-bezier(0.4, 0.0, 0.2, 1)",
        transform: indicatorTransform(activeView),
        pointerEvents: "none",
    }

    return (
        <div
            role="tablist"
            aria-label="Stage viewport"
            style={wrapperStyle}
            data-testid="viewport-toggle"
        >
            <div aria-hidden="true" style={indicatorStyle} />
            {TABS.map(tab => {
                const isActive = activeView === tab.id
                const Icon = tab.icon
                const tabStyle = {
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                    padding: 0,
                    margin: 0,
                    border: "none",
                    background: "transparent",
                    color: isActive
                        ? "var(--c0-bg, #111)"
                        : "var(--c5-text-dim, #bbb)",
                    fontSize: "0.7rem",
                    fontWeight: "bold",
                    letterSpacing: "0.05em",
                    cursor: "pointer",
                    borderRadius: "12px",
                    transition: "color 180ms ease",
                    position: "relative",
                    zIndex: 1,
                }
                return (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-label={tab.title}
                        title={tab.title}
                        data-testid={`viewport-toggle-${tab.id}`}
                        onClick={() => onChange(tab.id)}
                        style={tabStyle}
                    >
                        <Icon style={{ fontSize: "0.8rem" }} />
                        {tab.label}
                    </button>
                )
            })}
        </div>
    )
}

export default ViewportToggle