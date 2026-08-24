// FILE: src/components/HexapodPlot.js
import React from "react"
import createPlotlyComponent from "react-plotly.js/factory"
import * as defaults from "../templates"
import getNewPlotParams, { getTargetTraceUpdates } from "../templates/plotter"
import VirtualHexapod from "../hexapod/VirtualHexapod"
import { tRotZmatrix } from "../hexapod/geometry"

class HexapodPlot extends React.Component {
    cameraView = defaults.CAMERA_VIEW
    state = { ready: false }
    Plot = null
    Plotly = null
    graphDiv = null
    containerRef = null
    isPlotDragging = false

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

        window.addEventListener("pointerdown", this.handleGlobalPointerDown, true)
        window.addEventListener("pointerup", this.handleGlobalPointerUp, true)
        window.addEventListener("pointercancel", this.handleGlobalPointerUp, true)
    }

    componentWillUnmount() {
        window.removeEventListener("hexapod-anim-frame", this.handleAnimFrame)

        window.removeEventListener("pointerdown", this.handleGlobalPointerDown, true)
        window.removeEventListener("pointerup", this.handleGlobalPointerUp, true)
        window.removeEventListener("pointercancel", this.handleGlobalPointerUp, true)
        
        if (this.renderRafId) {
            cancelAnimationFrame(this.renderRafId)
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

    schedulePlotUpdate = () => {
        if (!this.renderRafId) {
            this.renderRafId = requestAnimationFrame(this.executePlotUpdate)
        }
    }

    executePlotUpdate = () => {
        this.renderRafId = null
        if (!this.Plotly || !this.Plotly.restyle || !this.graphDiv || !this.props.hexapod || !this.pendingAnimPose) return

        const dimensions = this.props.hexapod.dimensions
        if (!dimensions) return

        const detail = this.pendingAnimPose
        this.pendingAnimPose = null
        const pose = detail.pose || detail

        if (pose && typeof pose === "object") {
            try {
                let animHexapod = new VirtualHexapod(dimensions, pose, { wontRotate: true, assumeKnownGroundPoints: true })
                if (animHexapod && animHexapod.body && animHexapod.foundSolution) {
                    if (typeof detail.twist === "number" && detail.twist !== 0) {
                        animHexapod = animHexapod.cloneTrot(tRotZmatrix(detail.twist))
                    } else if (detail.matrix) {
                        animHexapod = animHexapod.cloneTrot(detail.matrix)
                    }
                    const { update, indices } = getTargetTraceUpdates(animHexapod)
                    this.Plotly.restyle(this.graphDiv, update, indices)
                }
            } catch (err) {
                console.warn("[HexapodPlot] Error applying anim frame:", err)
            }
        }
    }

    handleAnimFrame = (e) => {
        if (!e.detail) return
        this.pendingAnimPose = e.detail
        this.schedulePlotUpdate()
    }

    render() {
        if (!this.state.ready) return <p>Loading your cute robot...</p>
        if (!this.props.hexapod) return null

        const [data, layout] = getNewPlotParams(this.props.hexapod, this.cameraView)


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