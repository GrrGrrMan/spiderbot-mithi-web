// FILE: src/components/HexapodPlot.js
import React from "react"
import createPlotlyComponent from "react-plotly.js/factory"
import * as defaults from "../templates"
import getNewPlotParams, { getTargetTraceUpdates, getGhostTraceUpdates } from "../templates/plotter"
import VirtualHexapod from "../hexapod/VirtualHexapod"
import { tRotZmatrix } from "../hexapod/geometry"

class HexapodPlot extends React.Component {
    cameraView = defaults.CAMERA_VIEW
    state = { ready: false }
    Plot = null
    Plotly = null
    graphDiv = null
    containerRef = null
    latestGhostPose = null
    isPlotDragging = false
    
    // Add guards for telemetry background execution
    pendingTelemetryPose = null
    telemetryRafId = null

    shouldComponentUpdate(nextProps, nextState) {
        return (
            nextProps.revision !== this.props.revision ||
            nextProps.hexapod !== this.props.hexapod ||
            nextState.ready !== this.state.ready
        )
    }

    logCameraView = relayoutData => {
        this.cameraView = relayoutData["scene.camera"]
    }

    componentDidMount() {
        import("plotly.js-gl3d-dist-min").then(Plotly => {
            this.Plotly = Plotly
            this.Plot = createPlotlyComponent(Plotly)
            this.setState({ ready: true })
        })
        
        window.addEventListener("hexapod-anim-frame", this.handleAnimFrame)
        window.addEventListener("hexapod-telemetry-frame", this.handleTelemetryFrame)

        window.addEventListener("pointerdown", this.handleGlobalPointerDown, true)
        window.addEventListener("pointerup", this.handleGlobalPointerUp, true)
        window.addEventListener("pointercancel", this.handleGlobalPointerUp, true)
    }

    componentWillUnmount() {
        window.removeEventListener("hexapod-anim-frame", this.handleAnimFrame)
        window.removeEventListener("hexapod-telemetry-frame", this.handleTelemetryFrame)

        window.removeEventListener("pointerdown", this.handleGlobalPointerDown, true)
        window.removeEventListener("pointerup", this.handleGlobalPointerUp, true)
        window.removeEventListener("pointercancel", this.handleGlobalPointerUp, true)
        
        if (this.telemetryRafId) {
            cancelAnimationFrame(this.telemetryRafId)
        }
    }

    handleGlobalPointerDown = (e) => {
        const container = this.containerRef || this.graphDiv
        if (!container) return
        const isInside = container.contains(e.target)

        if (isInside) {
            this.isPlotDragging = true
            container.style.pointerEvents = "auto"
            try {
                const canvas = container.querySelector("canvas") || container
                if (e.pointerId !== undefined && canvas.setPointerCapture) {
                    canvas.setPointerCapture(e.pointerId)
                }
            } catch (_) {}
        } else {
            this.isPlotDragging = false
            container.style.pointerEvents = "none"
        }
    }

    handleGlobalPointerUp = (e) => {
        const container = this.containerRef || this.graphDiv
        this.isPlotDragging = false
        if (container) {
            container.style.pointerEvents = "auto"
            try {
                const canvas = container.querySelector("canvas") || container
                if (e && e.pointerId !== undefined && canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) {
                    canvas.releasePointerCapture(e.pointerId)
                }
            } catch (_) {}
        }
    }

    handleAnimFrame = (e) => {
        if (!this.Plotly || !this.Plotly.restyle || !this.graphDiv || !this.props.hexapod) return
        
        const detail = e.detail
        if (!detail) return

        const pose = detail.pose || detail
        if (!pose || typeof pose !== "object") return
        const dimensions = this.props.hexapod.dimensions
        if (!dimensions) return

        try {
            let animHexapod = new VirtualHexapod(dimensions, pose, { wontRotate: true })
            if (!animHexapod || !animHexapod.body || !animHexapod.foundSolution) return
            
            if (typeof detail.twist === "number" && detail.twist !== 0) {
                const matrix = tRotZmatrix(detail.twist)
                animHexapod = animHexapod.cloneTrot(matrix)
            } else if (detail.matrix) {
                animHexapod = animHexapod.cloneTrot(detail.matrix)
            }

            const { update, indices } = getTargetTraceUpdates(animHexapod)
            this.Plotly.restyle(this.graphDiv, update, indices)
        } catch (err) {
            console.warn("[HexapodPlot] Error applying anim frame:", err)
        }
    }

    handleTelemetryFrame = (e) => {
        if (!this.Plotly || !this.Plotly.restyle || !this.graphDiv || !this.props.hexapod) return

        this.pendingTelemetryPose = e.detail
        
        // Guard against invisible WebGL enqueueing crashing the browser out-of-tab
        if (!this.telemetryRafId) {
            this.telemetryRafId = requestAnimationFrame(() => {
                this.telemetryRafId = null
                
                const pose = this.pendingTelemetryPose
                if (!pose || typeof pose !== "object") return
                
                this.latestGhostPose = pose
                const dimensions = this.props.hexapod.dimensions
                if (!dimensions) return

                try {
                    const ghostHexapod = new VirtualHexapod(dimensions, pose, { wontRotate: true })
                    if (!ghostHexapod || !ghostHexapod.body || !ghostHexapod.foundSolution) return

                    const { update, indices } = getGhostTraceUpdates(ghostHexapod)
                    this.Plotly.restyle(this.graphDiv, update, indices)
                } catch (err) {
                    console.warn("[HexapodPlot] Error applying telemetry frame:", err)
                }
            })
        }
    }

    render() {
        if (!this.state.ready) return <p>Loading your cute robot...</p>
        if (!this.props.hexapod) return null

        let ghostHexapod = null
        if (this.latestGhostPose) {
            try {
                ghostHexapod = new VirtualHexapod(this.props.hexapod.dimensions, this.latestGhostPose, { wontRotate: true })
            } catch (e) {
                ghostHexapod = null
            }
        }

        const [data, layout] = getNewPlotParams(this.props.hexapod, this.cameraView, ghostHexapod)

        const props = {
            data,
            layout,
            onRelayout: this.logCameraView,
            revision: this.props.revision,
            config: { displaylogo: false, responsive: true, scrollZoom: true },
            style: { height: "100%", width: "100%" },
            useResizeHandler: true,
            onInitialized: (figure, graphDiv) => { this.graphDiv = graphDiv } 
        }

        const Plot = this.Plot
        return (
            <div 
                ref={el => { this.containerRef = el }}
                style={{ width: "100%", height: "100%", position: "relative", touchAction: "none" }}
            >
                <Plot {...props} />
            </div>
        )
    }
}

export default HexapodPlot