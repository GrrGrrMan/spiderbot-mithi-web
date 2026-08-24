import React, { Component } from "react"
import { sliderList, Card, ResetButton, ToggleSwitch } from "../generic"
import { SECTION_NAMES, GAIT_SLIDER_LABELS, GAIT_RANGE_PARAMS } from "../vars"
import getWalkSequence from "../../hexapod/solvers/walkSequenceSolver"
import PoseTable from "../pagePartials/PoseTable"
import { VirtualHexapod } from "../../hexapod"
import { tRotZmatrix } from "../../hexapod/geometry"
import { DEFAULT_GAIT_PARAMS, DEFAULT_MOTION_COMMAND } from "../../templates"

const ANIMATION_DELAY = 25

const getPose = (sequences, i) => {
    return Object.keys(sequences).reduce((newSequences, legPosition) => {
        const { alpha, beta, gamma } = sequences[legPosition]
        newSequences[legPosition] = { alpha: alpha[i], beta: beta[i], gamma: gamma[i] }
        return newSequences
    }, {})
}

const newSwitch = (id, value, checked, handleChange) => (
    <ToggleSwitch id={id} handleChange={handleChange} value={value} checked={checked} showValue={true} />
)

const switches = (switch1, switch2, switch3) => (
    <div className="grid-cols-3" style={{ paddingBottom: "20px" }}>
        {switch1}
        {switch2}
        {switch3}
    </div>
)

const countSteps = sequence => sequence["leftMiddle"].alpha.length

class WalkingGaitsPage extends Component {
    pageName = SECTION_NAMES.walkingGaits
    currentTwist = 0
    walkSequence = null
    state = {
        gaitParams: DEFAULT_GAIT_PARAMS,
        isAnimating: false,
        isTripodGait: true,
        isForward: true,
        inWalkMode: true,
        showGaitWidgets: true,
        animationCount: 0,
    }

    sendMotionCommand = (gaitParams, isTripodGait, inWalkMode, isForward, isAnimating) => {
        const publisher = this.props.publishThrottled
        if (!publisher) return

        const direction = isForward ? 1.0 : -1.0

        const vx = (isAnimating && inWalkMode) ? (gaitParams.hipSwing * 2.0 * direction) : 0.0
        const vy = 0.0
        const omega = (isAnimating && !inWalkMode) ? (gaitParams.hipSwing * 2.0 * direction) : 0.0

        publisher("hexapod/cmd", {
            type: "motion",
            gait: isTripodGait ? "tripod" : "ripple",
            vx: vx,
            vy: vy,
            omega: omega,
            step_height: gaitParams.liftSwing,
            leg_stance: gaitParams.legStance,
            hip_stance: gaitParams.hipStance,
            pos_x: 0,
            pos_y: -gaitParams.tx * 100.0,
            pos_z: gaitParams.tz * 132.0,
            roll: gaitParams.rx,
            pitch: gaitParams.ry
        })
    }
    componentDidMount = () => {
        this.props.onMount(this.pageName)
        const { isTripodGait, inWalkMode } = this.state
        this.setWalkSequence(DEFAULT_GAIT_PARAMS, isTripodGait, inWalkMode)
        window.addEventListener("hardware-watchdog-brake", this.reset)
    }

    componentDidUpdate = (prevProps) => {
        // If AI triggers an action externally, pause internal page animation loop
        if (this.props.activeExecutingAction && !prevProps.activeExecutingAction && this.state.isAnimating) {
            if (this.intervalID) clearInterval(this.intervalID)
            this.setState({ isAnimating: false })
        }
    }

    componentWillUnmount = () => {
        clearInterval(this.intervalID)
        if (this.motionHeartbeatID) clearInterval(this.motionHeartbeatID)
        window.removeEventListener("hardware-watchdog-brake", this.reset)
    }

    animate = () => {
        const { isForward, inWalkMode } = this.state

        const stepCount = countSteps(this.walkSequence)
        const animationCount = (this.state.animationCount + 1) % stepCount
        this.setState({ animationCount })

        const tempStep = isForward ? animationCount : stepCount - animationCount
        const step = Math.max(0, Math.min(stepCount - 1, tempStep))

        const pose = getPose(this.walkSequence, step)

        if (inWalkMode) {
            this.onUpdate(pose, this.currentTwist)
            return
        }

        const deltaTwist = (this.state.gaitParams.hipSwing * 2) / stepCount
        const twist = isForward
            ? (this.currentTwist + deltaTwist) % 360
            : (this.currentTwist - deltaTwist) % 360

        this.onUpdate(pose, twist)
    }

    onUpdate = (pose, currentTwist) => {
        this.currentTwist = currentTwist

        const { dimensions } = this.props.params
        const hexapod = new VirtualHexapod(dimensions, pose, { wontRotate: true })

        // ❗❗️HACK When we've passed undefined pose values for some reason
        if (!hexapod || !hexapod.body) {
            return
        }

        const matrix = tRotZmatrix(currentTwist)
        this.props.onUpdate("hexapod", { hexapod: hexapod.cloneTrot(matrix) })
    }

    setWalkSequence = (gaitParams, isTripodGait, inWalkMode) => {
        const gaitType = isTripodGait ? "tripod" : "ripple"
        const walkMode = inWalkMode ? "walking" : "rotating"

        const { dimensions } = this.props.params
        const { animationCount } = this.state

        this.walkSequence =
            getWalkSequence(dimensions, gaitParams, gaitType, walkMode) ||
            this.walkSequence

        const pose = getPose(this.walkSequence, animationCount)
        this.onUpdate(pose, this.currentTwist)
        this.setState({ gaitParams, isTripodGait, inWalkMode })
    }

    reset = () => {
        const { isTripodGait, inWalkMode } = this.state

        // 1. Halt the active Web UI animation loop & clear interval timers
        if (this.intervalID) {
            clearInterval(this.intervalID)
            this.intervalID = null
        }
        if (this.motionHeartbeatID) {
            clearInterval(this.motionHeartbeatID)
            this.motionHeartbeatID = null
        }

        // 2. Reset all parameters and mark animation as stopped
        this.currentTwist = 0
        this.setState({
            gaitParams: DEFAULT_GAIT_PARAMS,
            animationCount: 0,
            isAnimating: false,
        })

        // 3. Re-compute stationary neutral stance and render neutral pose
        this.setWalkSequence(DEFAULT_GAIT_PARAMS, isTripodGait, inWalkMode)

        // 4. Send explicit halt command to physical robot
        if (this.props.publishThrottled) {
            this.props.publishThrottled("hexapod/cmd", DEFAULT_MOTION_COMMAND)
        }
    }

    updateGaitParams = (name, value) => {
        const { isTripodGait, inWalkMode, isForward, isAnimating } = this.state
        const gaitParams = { ...this.state.gaitParams, [name]: value }
        this.setWalkSequence(gaitParams, isTripodGait, inWalkMode)
        this.sendMotionCommand(gaitParams, isTripodGait, inWalkMode, isForward, isAnimating)
    }

    toggleWalkMode = () => {
        const { gaitParams, isTripodGait, isForward, isAnimating } = this.state
        const inWalkMode = !this.state.inWalkMode
        this.setWalkSequence(gaitParams, isTripodGait, inWalkMode)
        this.sendMotionCommand(gaitParams, isTripodGait, inWalkMode, isForward, isAnimating)
    }

    toggleGaitType = () => {
        const { gaitParams, inWalkMode, isForward, isAnimating } = this.state
        const isTripodGait = !this.state.isTripodGait
        this.setWalkSequence(gaitParams, isTripodGait, inWalkMode)
        this.sendMotionCommand(gaitParams, isTripodGait, inWalkMode, isForward, isAnimating)
    }

    toggleWidgets = () => this.setState({ showGaitWidgets: !this.state.showGaitWidgets })

    toggleDirection = () => {
        const { gaitParams, isTripodGait, inWalkMode, isAnimating } = this.state
        const isForward = !this.state.isForward
        this.setState({ isForward })
        this.sendMotionCommand(gaitParams, isTripodGait, inWalkMode, isForward, isAnimating)
    }

    toggleAnimating = () => {
        const isAnimating = !this.state.isAnimating
        this.setState({ isAnimating })

        if (isAnimating) {
            this.intervalID = setInterval(this.animate, ANIMATION_DELAY)
        } else {
            clearInterval(this.intervalID)
        }

        const { gaitParams, isTripodGait, inWalkMode, isForward } = this.state
        this.sendMotionCommand(gaitParams, isTripodGait, inWalkMode, isForward, isAnimating)
    }

    get widgetsSwitch() {
        const value = this.state.showGaitWidgets ? "controlsShown" : "poseShown"
        return newSwitch("widgetSw", value, this.state.showGaitWidgets, this.toggleWidgets)
    }

    get animatingSwitch() {
        const value = this.state.isAnimating ? "PLAYING..." : "...PAUSED. "
        return newSwitch("animatingSw", value, this.state.isAnimating, this.toggleAnimating)
    }

    get gaitTypeSwitch() {
        const value = this.state.isTripodGait ? "tripodGait" : "rippleGait"
        return newSwitch("gaitSw", value, this.state.isTripodGait, this.toggleGaitType)
    }

    get directionSwitch() {
        const value = this.state.isForward ? "isForward" : "isBackward"
        return newSwitch("directionSw", value, this.state.isForward, this.toggleDirection)
    }

    get rotateSwitch() {
        const value = this.state.inWalkMode ? "isWalk" : "isRotate"
        return newSwitch("rotateSw", value, this.state.inWalkMode, this.toggleWalkMode)
    }

    get sliders() {
        const sliders = sliderList({
            names: GAIT_SLIDER_LABELS,
            values: this.state.gaitParams,
            rangeParams: GAIT_RANGE_PARAMS,
            handleChange: this.updateGaitParams,
        })

        return <div className="grid-cols-2">{sliders}</div>
    }

    get animationCount() {
        const { isAnimating, animationCount } = this.state
        return (
            <div className="text" hidden={!isAnimating}>
                {animationCount}
            </div>
        )
    }

    render() {
        const animationControlSwitches = switches(
            this.animatingSwitch,
            this.widgetsSwitch
        )
        const gaitControlSwitches = switches(
            this.gaitTypeSwitch,
            this.directionSwitch,
            this.rotateSwitch
        )

        const { showGaitWidgets } = this.state
        const { pose } = this.props.params

        return (
            <Card title={<h2>{this.pageName}</h2>} other={this.animationCount}>
                {animationControlSwitches}

                <div hidden={!showGaitWidgets}>
                    {gaitControlSwitches}
                    {this.sliders}
                    <ResetButton reset={this.reset} />
                </div>

                <div hidden={showGaitWidgets}>
                    <PoseTable pose={pose} />
                </div>
            </Card>
        )
    }
}

export default WalkingGaitsPage
