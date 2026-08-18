import React from "react"
import createPlotlyComponent from "react-plotly.js/factory"
import * as defaults from "../templates"
import getNewPlotParams, { getTargetTraceUpdates, getGhostTraceUpdates } from "../templates/plotter"
import VirtualHexapod from "../hexapod/VirtualHexapod"

class HexapodPlot extends React.Component {
    cameraView = defaults.CAMERA_VIEW
    state = { ready: false }
    Plot = null
    Plotly = null
    graphDiv = null
    latestGhostPose = null

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
    }

    componentWillUnmount() {
        window.removeEventListener("hexapod-anim-frame", this.handleAnimFrame)
        window.removeEventListener("hexapod-telemetry-frame", this.handleTelemetryFrame)
    }

    handleAnimFrame = (e) => {
        if (!this.Plotly || !this.Plotly.restyle || !this.graphDiv || !this.props.hexapod) return
        
        const pose = e.detail
        const dimensions = this.props.hexapod.dimensions
        const animHexapod = new VirtualHexapod(dimensions, pose, { wontRotate: true })
        
        const { update, indices } = getTargetTraceUpdates(animHexapod)
        this.Plotly.restyle(this.graphDiv, update, indices)
    }

    handleTelemetryFrame = (e) => {
        if (!this.Plotly || !this.Plotly.restyle || !this.graphDiv || !this.props.hexapod) return

        const pose = e.detail
        this.latestGhostPose = pose
        const dimensions = this.props.hexapod.dimensions
        const ghostHexapod = new VirtualHexapod(dimensions, pose, { wontRotate: true })

        const { update, indices } = getGhostTraceUpdates(ghostHexapod)
        this.Plotly.restyle(this.graphDiv, update, indices)
    }

    render() {
        if (!this.state.ready) return <p>Loading your cute robot...</p>
        if (!this.props.hexapod) return null

        let ghostHexapod = null
        if (this.latestGhostPose) {
            ghostHexapod = new VirtualHexapod(this.props.hexapod.dimensions, this.latestGhostPose, { wontRotate: true })
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
        return <Plot {...props} />
    }
}

export default HexapodPlot