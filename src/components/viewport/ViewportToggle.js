// FILE: src/components/viewport/ViewportToggle.js
import React, { useRef, useCallback } from "react"
import { FaCube, FaVideo } from "react-icons/fa"
import { useCornerSnap } from "../../hooks/useCornerSnap"

const TABS = [
    { id: "sim", label: "SIM", icon: FaCube, title: "3D simulator view" },
    { id: "cam", label: "CAM", icon: FaVideo, title: "Live MJPEG camera view" },
]

const indicatorTransform = (activeId) =>
    activeId === "cam" ? "translateX(100%)" : "translateX(0%)"

const ViewportToggle = ({ activeView, onChange }) => {
    const clickedTabRef = useRef(null)

    const {
        elementRef,
        pos,
        isDragging,
        hasMovedRef,
        activeCorner,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handlePointerCancel,
    } = useCornerSnap({
        boundary: "parent",
        defaultCorner: "bottom-right",
        marginX: 10,
        marginY: 10,
        defaultWidth: 108,
        defaultHeight: 28,
    })

    // 1. Capture which tab was tapped/clicked before pointer capture redirects events
    const onWrapperPointerDown = useCallback((e) => {
        const tabBtn = e.target.closest("[data-tab-id]")
        clickedTabRef.current = tabBtn ? tabBtn.dataset.tabId : null
        handlePointerDown(e)
    }, [handlePointerDown])

    // 2. On release, if no drag movement occurred, execute tab switch immediately
    const onWrapperPointerUp = useCallback((e) => {
        const wasDrag = hasMovedRef.current
        const targetTab = clickedTabRef.current
        handlePointerUp(e)

        if (!wasDrag && targetTab) {
            onChange(targetTab)
            clickedTabRef.current = null
        }
    }, [handlePointerUp, hasMovedRef, onChange])

    const wrapperStyle = {
        position: "absolute",
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        zIndex: 20,
        display: "flex",
        alignItems: "stretch",
        width: "108px",
        height: "28px",
        padding: "2px",
        borderRadius: "14px",
        background: "rgba(10, 15, 25, 0.85)",
        backdropFilter: "blur(8px)",
        border: `1px solid ${isDragging ? "var(--c1-green)" : "rgba(41, 128, 185, 0.6)"}`,
        boxShadow: isDragging
            ? "0 8px 20px rgba(0, 0, 0, 0.8), 0 0 14px rgba(50, 255, 126, 0.5)"
            : "0 2px 8px rgba(0, 0, 0, 0.5), 0 0 6px rgba(41, 128, 185, 0.3)",
        cursor: isDragging ? "grabbing" : "pointer",
        userSelect: "none",
        touchAction: "none",
        transform: isDragging ? "scale(1.06)" : "scale(1)",
        transition: isDragging
            ? "none"
            : "left 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.2s, box-shadow 0.2s, border-color 0.2s",
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
            ref={elementRef}
            role="tablist"
            aria-label="Stage viewport"
            style={wrapperStyle}
            data-testid="viewport-toggle"
            title={`Drag to snap to any corner (Current: ${activeCorner})`}
            onPointerDown={onWrapperPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={onWrapperPointerUp}
            onPointerCancel={handlePointerCancel}
            onLostPointerCapture={handlePointerCancel}
        >
            <div aria-hidden="true" style={indicatorStyle} />
            {TABS.map((tab) => {
                const isActive = activeView === tab.id
                const Icon = tab.icon

                return (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        data-tab-id={tab.id}
                        aria-selected={isActive}
                        aria-label={tab.title}
                        title={tab.title}
                        data-testid={`viewport-toggle-${tab.id}`}
                        onClick={(e) => {
                            // Accessibility fallback for keyboard navigation (Enter/Space) and unit tests
                            e.stopPropagation()
                            if (!hasMovedRef.current) {
                                onChange(tab.id)
                            }
                        }}
                        style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "4px",
                            padding: 0,
                            margin: 0,
                            border: "none",
                            background: "transparent",
                            color: isActive ? "var(--c0-bg, #111)" : "var(--c5-text-dim, #cbd5e1)",
                            fontSize: "0.7rem",
                            fontWeight: "bold",
                            letterSpacing: "0.05em",
                            cursor: "pointer",
                            borderRadius: "12px",
                            transition: "color 180ms ease",
                            position: "relative",
                            zIndex: 1,
                        }}
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