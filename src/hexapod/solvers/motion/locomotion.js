// src/hexapod/solvers/motion/locomotion.js
import getWalkSequence from "../walkSequenceSolver"
import { DEFAULT_GAIT_PARAMS } from "../../../templates"
import { DEFAULT_POSE, interpolatePoses, blendTwoPoses, quinticEase } from "./interpolation"
import { getIkPose } from "./presets"
import { buildSequenceFromKeyframesAsync } from "./workerPool"

export function expandGaitSequence(walkSequence, stepsPerFrame = 3, loopCount = 1) {
    if (!walkSequence) return []
    const legKeys = Object.keys(walkSequence)
    if (legKeys.length === 0) return []

    const rawLength = walkSequence[legKeys[0]]?.alpha?.length || 0
    if (rawLength === 0) return []

    const rawPoses = []
    for (let f = 0; f < rawLength; f++) {
        const pose = {}
        legKeys.forEach(leg => {
            const legData = walkSequence[leg]
            pose[leg] = {
                alpha: legData?.alpha?.[f] !== undefined ? legData.alpha[f] : 0,
                beta: legData?.beta?.[f] !== undefined ? legData.beta[f] : 0,
                gamma: legData?.gamma?.[f] !== undefined ? legData.gamma[f] : 0,
            }
        })
        rawPoses.push(pose)
    }

    let repeatedPoses = []
    for (let l = 0; l < Math.max(1, loopCount); l++) {
        const slice = (l > 0 && rawPoses.length > 1) ? rawPoses.slice(1) : rawPoses
        repeatedPoses = repeatedPoses.concat(slice)
    }

    let smoothFrames = []
    for (let i = 0; i < repeatedPoses.length - 1; i++) {
        const sub = interpolatePoses(repeatedPoses[i], repeatedPoses[i + 1], stepsPerFrame)
        if (i > 0) sub.shift()
        smoothFrames = smoothFrames.concat(sub)
    }
    return smoothFrames
}

export async function generateParametricPoseFramesAsync(motionPayload, dimensions, startPose = DEFAULT_POSE, steps = 20) {
    const p = motionPayload || {}
    const tx = (p.pos_x || p.tx || 0) / 100.0
    const ty = -(p.pos_y || p.ty || 0) / 100.0
    const tz = (p.pos_z || p.tz || 0) / 132.0
    // Correct Simulator Axis Mapping: Pitch is X-rotation (rx), Roll is Y-rotation (ry)
    const rx = -(p.pitch !== undefined ? p.pitch : (p.rx || 0))
    const ry = -(p.roll !== undefined ? p.roll : (p.ry || 0))
    const rz = -(p.yaw !== undefined ? p.yaw : (p.rz || 0))
    const hipStance = p.hip_stance !== undefined ? p.hip_stance : 20
    const legStance = p.leg_stance !== undefined ? p.leg_stance : 0

    const targetPose = getIkPose(dimensions, { tx, ty, tz, rx, ry, rz, hipStance, legStance })
    const frames = await buildSequenceFromKeyframesAsync([startPose, targetPose], steps)
    // Hold final pose for duration if specified
    const durMs = p.duration_ms || 2000
    const holdFramesCount = Math.max(1, Math.round((durMs / 1000) * 60) - steps)
    const finalFrame = frames[frames.length - 1]
    const heldFrames = Array(holdFramesCount).fill(finalFrame)
    return frames.concat(heldFrames)
}

export async function generateLocomotionFrames(
    actionId,
    dimensions,
    durationMs = 3000,
    startPose = DEFAULT_POSE,
    customGaitParams = null,
    initialHeading = 0
) {
    const isSpin = actionId === "spin"
    const isTurnLeft = actionId === "turn_left" || (customGaitParams && customGaitParams.omega < 0)
    const isTurnRight = actionId === "turn_right" || actionId === "rotate" || (customGaitParams && customGaitParams.omega > 0)
    const isRotate = isSpin || isTurnLeft || isTurnRight
    const walkMode = isRotate ? "rotating" : "walking"
    const isBackward = actionId === "walk_backward" || (customGaitParams && customGaitParams.vx < 0)

    const gaitParams = {
        ...DEFAULT_GAIT_PARAMS,
        hipSwing: isSpin ? 35 : 25,
        liftSwing: customGaitParams?.step_height || 38,
        stepCount: 5,
        ...(customGaitParams || {}),
    }

    const walkSeq = getWalkSequence(dimensions, gaitParams, "tripod", walkMode)
    if (!walkSeq) return [{ pose: startPose, twist: initialHeading }, { pose: DEFAULT_POSE, twist: initialHeading }]

    // Scale cycle counts to fill exact duration at 60 FPS (approx 1 cycle = 0.8s = 48 frames)
    const cycleTimeS = customGaitParams?.cycle_time || 0.8
    const totalCycles = Math.max(1, Math.round(durationMs / (cycleTimeS * 1000)))
    const stepsPerPose = Math.max(2, Math.round((cycleTimeS * 60) / 10))
    const rawPoses = expandGaitSequence(walkSeq, stepsPerPose, totalCycles)

    if (isBackward || (isRotate && isTurnRight && !isSpin)) {
        rawPoses.reverse()
    }

    const turnRateDegPerSec = (customGaitParams?.omega) ? Math.abs(customGaitParams.omega) : (isSpin ? 50 : 30)
    const totalRotationDeg = (turnRateDegPerSec * (durationMs / 1000.0)) * (isTurnLeft ? -1 : 1)

    const totalSteps = rawPoses.length
    const frames = []
    const baseHeading = initialHeading || 0

    // Lead-in smooth ramp from current pose
    const leadInSteps = 6
    for (let i = 0; i <= leadInSteps; i++) {
        const t = i / leadInSteps
        const ease = quinticEase(t)
        frames.push({
            pose: blendTwoPoses(startPose, rawPoses[0], ease),
            twist: baseHeading,
        })
    }

    // Steady-state continuous locomotion
    for (let i = 0; i < totalSteps; i++) {
        const progress = totalSteps > 1 ? i / (totalSteps - 1) : 0
        const currentTwist = isRotate ? (baseHeading + totalRotationDeg * progress) : baseHeading
        frames.push({
            pose: rawPoses[i],
            twist: currentTwist,
        })
    }

    // Lead-out holding final heading
    const finalHeading = isRotate ? (baseHeading + totalRotationDeg) : baseHeading
    const lastPose = rawPoses[rawPoses.length - 1] || DEFAULT_POSE
    const leadOutSteps = 6
    for (let i = 1; i <= leadOutSteps; i++) {
        const t = i / leadOutSteps
        const ease = quinticEase(t)
        frames.push({
            pose: blendTwoPoses(lastPose, DEFAULT_POSE, ease),
            twist: finalHeading,
        })
    }

    return frames
}