import React, { Component } from "react"
import { sliderList, Card, ResetButton } from "../generic"
import { DEFAULT_POSE, DEFAULT_PATTERN_PARAMS } from "../../templates"
import { SECTION_NAMES, ANGLE_NAMES, RANGE_PARAMS } from "../vars"
import { buildServoBatchPayload } from "../../utils/servoMapper"
import { UPDATE_TYPES } from "../../AppHelpers"


class LegPatternPage extends Component {
    pageName = SECTION_NAMES.legPatterns
    state = { patternParams: DEFAULT_PATTERN_PARAMS }

    componentDidMount = () => {
        this.props.onMount(this.pageName)
        this.reset()
    }

    reset = () => {
            let defaultPose = {}
            for (const leg in DEFAULT_POSE) {
                defaultPose[leg] = DEFAULT_PATTERN_PARAMS
            }

            this.props.onUpdate(UPDATE_TYPES.POSE, { pose: defaultPose })
            this.setState({ patternParams: DEFAULT_PATTERN_PARAMS })

            if (this.props.publishThrottled) {
                const batchPayload = buildServoBatchPayload(defaultPose)
                this.props.publishThrottled("hexapod/cmd", batchPayload)
            }
        }

    updatePatternPose = (name, value) => {
        const patternParams = { ...this.state.patternParams, [name]: Number(value) }
        let newPose = {}

        for (const leg in DEFAULT_POSE) {
            newPose[leg] = patternParams
        }

        this.props.onUpdate("pose", { pose: newPose })
        this.setState({ patternParams })

        if (this.props.publishThrottled) {
            const batchPayload = buildServoBatchPayload(newPose)
            this.props.publishThrottled("hexapod/cmd", batchPayload)
        }
    }

    get sliders() {
        return sliderList({
            names: ANGLE_NAMES,
            values: this.state.patternParams,
            handleChange: this.updatePatternPose,
            rangeParams: RANGE_PARAMS,
        })
    }

    render = () => (
        <Card title={<h2>{this.pageName}</h2>}>
            <div className="grid-cols-1">{this.sliders}</div>
            <ResetButton reset={this.reset} />
        </Card>
    )
}

export default LegPatternPage
