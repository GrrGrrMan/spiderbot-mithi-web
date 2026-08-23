// web-ui/src/components/camera/DualStageViewport.js
import React, { useEffect } from "react"
import CameraView from "./CameraView"
import HexapodPlot from "../HexapodPlot"

const DualStageViewport = ({
    camConfig,
    camTelemetry,
    isConnected,
    hexapod,
    revision,
}) => {
    // Trigger Plotly container dimension recalculation on layout load
    useEffect(() => {
        const id = requestAnimationFrame(() => {
            window.dispatchEvent(new Event("resize"))
        })
        return () => cancelAnimationFrame(id)
    }, [])

    return (
        <div style={containerStyle} data-testid="dual-stage-viewport">
            {/* Left Stage: Live MJPEG Camera Feed */}
            <div style={stageWrapperStyle}>
                <div style={badgeStyle}>LIVE CAMERA FEED</div>
                <div style={viewportInnerStyle}>
                    <CameraView
                        config={camConfig}
                        telemetry={camTelemetry}
                        isConnected={isConnected}
                    />
                </div>
            </div>

            {/* Right Stage: 3D Kinematics Simulation */}
            <div style={stageWrapperStyle}>
                <div style={badgeStyle}>3D VIRTUAL SIMULATOR</div>
                <div style={viewportInnerStyle}>
                    <HexapodPlot
                        revision={revision}
                        hexapod={hexapod}
                    />
                </div>
            </div>
        </div>
    )
}

const containerStyle = {
    display: "flex",
    flexDirection: "row",
    gap: "10px",
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
}

const stageWrapperStyle = {
    flex: "1 1 0",
    minWidth: 0,
    height: "100%",
    position: "relative",
    backgroundColor: "#0a0f1d",
    border: "1px solid var(--c4-blue)",
    borderRadius: "8px",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
}

const viewportInnerStyle = {
    position: "relative",
    width: "100%",
    flex: 1,
    height: "100%",
}

const badgeStyle = {
    position: "absolute",
    top: "8px",
    left: "8px",
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    borderRadius: "6px",
    padding: "3px 8px",
    color: "#fff",
    fontSize: "0.65rem",
    fontWeight: "bold",
    letterSpacing: "0.05em",
    pointerEvents: "none",
}

export default DualStageViewport