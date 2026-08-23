// FILE: src/components/hub/HubFab.js
import React from "react"
import { FaSlidersH } from "react-icons/fa"

export const HubFab = ({ isOpen, onToggle, activeColor, isExecuting, cornerSnap }) => {
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
    } = cornerSnap

    return (
        <button
            ref={elementRef}
            type="button"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onLostPointerCapture={handlePointerCancel}
            onClick={() => {
                if (!hasMovedRef.current) {
                    onToggle()
                }
            }}
            style={{
                position: "fixed",
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                zIndex: 99,
                opacity: isOpen ? 0 : 1,
                pointerEvents: isOpen ? "none" : "auto",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "24px",
                backgroundColor: "rgba(23, 33, 43, 0.95)",
                border: `1.5px solid ${isDragging ? "var(--c1-green)" : isOpen ? "var(--c2-pink)" : "var(--c4-blue)"}`,
                boxShadow: isDragging
                    ? "0 14px 28px rgba(0, 0, 0, 0.85), 0 0 20px rgba(50, 255, 126, 0.55)"
                    : "0 6px 20px rgba(0, 0, 0, 0.6), 0 0 12px rgba(41, 128, 185, 0.4)",
                cursor: isDragging ? "grabbing" : "pointer",
                color: "#e2e8f0",
                backdropFilter: "blur(8px)",
                whiteSpace: "nowrap",
                flexShrink: 0,
                minWidth: "max-content",
                transform: isOpen ? "scale(0.8)" : isDragging ? "scale(1.06)" : "scale(1)",
                // Zero-lag instant trackpad response while dragging; spring snap on release
                transition: isDragging
                    ? "none"
                    : "left 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease, box-shadow 0.25s, border-color 0.25s",
                userSelect: "none",
                touchAction: "none",
            }}
            title={`Drag to snap to any corner (Current: ${activeCorner}), click to toggle Control Hub`}
            aria-label="Toggle Control Hub"
        >
            <FaSlidersH
                style={{
                    fontSize: "1.1rem",
                    color: isDragging ? "var(--c1-green)" : isOpen ? "var(--c2-pink)" : "var(--c1-green)",
                    flexShrink: 0,
                }}
            />
            <span style={{ fontSize: "0.75rem", fontWeight: "bold", letterSpacing: "0.04em", pointerEvents: "none", whiteSpace: "nowrap" }}>
                {isOpen ? "CLOSE HUB" : "CONTROL HUB"}
            </span>
            {isExecuting && (
                <span
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: "var(--c2-pink)",
                        boxShadow: "0 0 8px var(--c2-pink)",
                        pointerEvents: "none",
                        flexShrink: 0,
                    }}
                />
            )}
        </button>
    )
}