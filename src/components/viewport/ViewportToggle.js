// web-ui/src/components/viewport/ViewportToggle.js
//
// P2 Phase B: pill-style SIM/CAM toggle that sits absolutely-positioned at the
// top-right inside the #plot stage container. Renders two tabs (SIM, CAM);
// a single sliding indicator follows the active tab via CSS transform so the
// transition is GPU-accelerated and doesn't reflow.
//
// Accessibility: role="tablist" + role="tab" + aria-pressed + aria-label on
// each tab. Keyboard activation handled natively by <button>.
//
// Icons come from the existing react-icons/fa dep (v3.10.0) — no new installs.

import React from "react"
import { FaCube, FaVideo } from "react-icons/fa"

// FA4's "video-camera" was renamed to "video" in Font Awesome 5 (the set
// react-icons v3.10.0 ships). FaVideoCamera does NOT exist in v3.x — using it
// yields `undefined` at render time ("Element type is invalid"). Verified
// against the installed node_modules/react-icons/fa/index.d.ts (v3.10.0):
// line ~685 has FaCube, line ~1378 has FaVideo. See
// docs/future-roadmap/camera/README.md §B for the same note.

const TABS = [
    { id: "sim", label: "SIM", icon: FaCube, title: "3D simulator view" },
    { id: "cam", label: "CAM", icon: FaVideo, title: "Live MJPEG camera view" },
]

// Indicator width is half the pill width; the CSS transform shifts it
// horizontally by exactly one tab's width when active changes.
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
                        aria-pressed={isActive}
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
