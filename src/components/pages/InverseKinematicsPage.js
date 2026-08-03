import React, { Component } from "react"
import { sliderList, Card, ResetButton, AlertBox } from "../generic"
import { solveInverseKinematics } from "../../hexapod"
import { SECTION_NAMES, IK_SLIDERS_LABELS, RANGE_PARAMS } from "../vars"
import { DEFAULT_POSE, DEFAULT_IK_PARAMS } from "../../templates"
import PoseTable from "../pagePartials/PoseTable"
import { UPDATE_TYPES } from "../../AppHelpers"
import { buildServoBatchPayload } from "../../utils/servoMapper"



class InverseKinematicsPage extends Component {
    pageName = SECTION_NAMES.inverseKinematics
    state = { ikParams: DEFAULT_IK_PARAMS, errorMessage: null }

    componentDidMount = () => this.props.onMount(this.pageName)

    reset = () => {
            this.props.onUpdate(UPDATE_TYPES.POSE, { pose: DEFAULT_POSE })
            this.setState({ ikParams: DEFAULT_IK_PARAMS })

            if (this.props.publishThrottled) {
                const batchPayload = buildServoBatchPayload(DEFAULT_POSE)
                this.props.publishThrottled("hexapod/cmd", batchPayload)
            }
        }

    updateHexapodPlot = (hexapod, ikParams) => {
        this.setState({ ikParams, errorMessage: null })
        this.props.onUpdate("hexapod", { hexapod })
    }

    updateIkParams = (name, value) => {
        const ikParams = { ...this.state.ikParams, [name]: value }
        const result = solveInverseKinematics(this.props.params.dimensions, ikParams)

        if (!result.obtainedSolution) {
            this.props.onUpdate("hexapod", { hexapod: null })
            this.setState({ errorMessage: result.message })
            return
        }

        this.updateHexapodPlot(result.hexapod, ikParams)

        if (this.props.publishThrottled) {
            this.props.publishThrottled("hexapod/cmd", {
                type: "motion",
                pos_x: ikParams.ty * 100.0,  // Web +Y translation -> FW +X
                pos_y: -ikParams.tx * 100.0, // Web +X translation -> FW -Y
                pos_z: ikParams.tz * 100.0,  // Height offset
                roll: ikParams.rx,
                pitch: ikParams.ry,
                yaw: ikParams.rz,
                leg_stance: ikParams.legStance,
                hip_stance: ikParams.hipStance
            })
        }
    }
    get sliders() {
        return sliderList({
            names: IK_SLIDERS_LABELS,
            values: this.state.ikParams,
            handleChange: this.updateIkParams,
            rangeParams: RANGE_PARAMS,
        })
    }

    get additionalInfo() {
        if (this.state.errorMessage) {
            return <AlertBox info={this.state.errorMessage} />
        }

        return <PoseTable pose={this.props.params.pose} />
    }

    render = () => (
        <Card title={<h2>{this.pageName}</h2>}>
            <div className="grid-cols-3">{this.sliders.slice(0, 6)}</div>
            <div className="grid-cols-2">{this.sliders.slice(6, 8)}</div>
            <ResetButton reset={this.reset} />
            {this.additionalInfo}
        </Card>
    )
}

export default InverseKinematicsPage
