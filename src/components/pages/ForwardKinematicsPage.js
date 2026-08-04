import React, { Component } from "react"
import { UPDATE_TYPES } from "../../AppHelpers"
import LegPoseWidget from "../pagePartials/LegPoseWidgets"
import { buildServoBatchPayload } from "../../utils/servoMapper"
import { Card, ToggleSwitch, ResetButton, NumberInputField, Slider } from "../generic"
import { DEFAULT_POSE } from "../../templates"
import { SECTION_NAMES, LEG_NAMES } from "../vars"

class ForwardKinematicsPage extends Component {
    pageName = SECTION_NAMES.forwardKinematics
    state = { WidgetType: NumberInputField }

    componentDidMount = () => this.props.onMount(this.pageName)

    reset = () => {
            this.props.onUpdate(UPDATE_TYPES.POSE, { pose: DEFAULT_POSE })
            this.setState({ pose: DEFAULT_POSE })

            if (this.props.publishThrottled) {
                const batchPayload = buildServoBatchPayload(DEFAULT_POSE)
                this.props.publishThrottled("hexapod/cmd", batchPayload)
            }
        }

    updatePose = (name, angle, value) => {
        const pose = this.props.params.pose
        const newPose = {
            ...pose,
            [name]: { ...pose[name], [angle]: value },
        }
        this.props.onUpdate("pose", { pose: newPose })

        if (this.props.publishThrottled) {
            const batchPayload = buildServoBatchPayload(newPose)
            this.props.publishThrottled("hexapod/cmd", batchPayload)
        }
    }

    toggleMode = () => {
        const WidgetType = this.state.WidgetType === Slider ? NumberInputField : Slider
        this.setState({ WidgetType })
    }

    legPoseWidget = name => (
        <LegPoseWidget
            key={name}
            name={name}
            pose={this.props.params.pose[name]}
            onUpdate={this.updatePose}
            WidgetType={this.state.WidgetType}
            renderStacked={this.state.WidgetType === Slider}
        />
    )

    get toggleSwitch() {
        const props = {
            id: "FwdKinematicsSwitch",
            value: this.state.WidgetType === Slider ? "Slide" : "Input",
            checked: this.state.WidgetType === Slider,
            handleChange: this.toggleMode,
            showValue: true,
        }

        return <ToggleSwitch {...props} />
    }

    render = () => (
        <Card title={<h2>{this.pageName}</h2>} other={this.toggleSwitch}>
            <div className="grid-cols-2">
                {LEG_NAMES.map(name => this.legPoseWidget(name))}
            </div>
            <ResetButton reset={this.reset} />
        </Card>
    )
}

export default ForwardKinematicsPage
