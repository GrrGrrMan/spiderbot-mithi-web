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

export async function generateParametricPoseFramesAsync(motionPayload, dimensions, startPose = DEFAULT_POSE, steps = 20, durationMs = 2500) {
    const p = motionPayload || {}
    const tx = (p.pos_x || p.tx || 0) / 100.0
    const ty = -(p.pos_y || p.ty || 0) / 100.0
    const tz = (p.pos_z || p.tz || 0) / 132.0
    // Simulator Coordinate Mapping: Pitch = X-rotation (rx), Roll = Y-rotation (ry), Yaw = Z-rotation (rz)
    const rx = -(p.pitch !== undefined ? p.pitch : (p.rx || 0))
    const ry = -(p.roll !== undefined ? p.roll : (p.ry || 0))
    const rz = -(p.yaw !== undefined ? p.yaw : (p.rz || 0))
    const hipStance = p.hip_stance !== undefined ? p.hip_stance : 20
    const legStance = p.leg_stance !== undefined ? p.leg_stance : 0

    const targetPose = getIkPose(dimensions, { tx, ty, tz, rx, ry, rz, hipStance, legStance })
    const frames = await buildSequenceFromKeyframesAsync([startPose, targetPose], steps)
    const totalTargetFrames = Math.max(steps + 1, Math.round((durationMs / 1000) * 60))
    const holdFramesCount = Math.max(1, totalTargetFrames - frames.length)
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
        hipSwing: isSpin ? 30 : 25,
        liftSwing: customGaitParams?.step_height || 38,
        stepCount: 5,
        ...(customGaitParams || {}),
    }

    const walkSeq = getWalkSequence(dimensions, gaitParams, "tripod", walkMode)
    if (!walkSeq) return [{ pose: startPose, twist: initialHeading }, { pose: DEFAULT_POSE, twist: initialHeading }]

    // Total animation frames at 60 FPS
    const totalTargetFrames = Math.max(30, Math.round((durationMs / 1000) * 60))
    const durationS = durationMs / 1000.0

    // Calibrated turn rate (deg/s): default 25°/s for turn, 50°/s for spin
    const omegaRate = Math.abs(customGaitParams?.omega) || (isSpin ? 50 : 25)
    // Turn Left / Spin: CCW (+1). Turn Right: CW (-1).
    const rotationSign = isTurnRight ? -1 : 1
    const totalRotationDeg = isRotate ? (rotationSign * omegaRate * durationS) : 0

    // Physical coupling: 1 full tripod cycle sweeps 4 * hipSwing degrees.
    // Cycle duration is matched to omegaRate so that foot velocity relative to ground is strictly 0.0.
    const rotationPerCycle = 4 * gaitParams.hipSwing
    const totalCycles = isRotate
        ? Math.max(0.1, (omegaRate * durationS) / rotationPerCycle)
        : Math.max(0.5, durationS / (customGaitParams?.cycle_time || 1.0))

    // Extract cyclic discrete poses (20 poses for stepCount = 5)
    const legKeys = Object.keys(walkSeq)
    const cyclePoseCount = walkSeq[legKeys[0]]?.alpha?.length || 0
    const rawCyclePoses = []
    for (let f = 0; f < cyclePoseCount; f++) {
        const pose = {}
        legKeys.forEach(leg => {
            const legData = walkSeq[leg]
            pose[leg] = {
                alpha: legData?.alpha?.[f] !== undefined ? legData.alpha[f] : 0,
                beta: legData?.beta?.[f] !== undefined ? legData.beta[f] : 0,
                gamma: legData?.gamma?.[f] !== undefined ? legData.gamma[f] : 0,
            }
        })
        rawCyclePoses.push(pose)
    }

    // When turning right (CW) or walking backward, step the legs in reverse
    if (isBackward || (isRotate && isTurnRight && !isSpin)) {
        rawCyclePoses.reverse()
    }

    const leadInSteps = 10
    const leadOutSteps = 10
    const steadyFramesCount = Math.max(10, totalTargetFrames - leadInSteps - leadOutSteps)

    const frames = []
    const baseHeading = initialHeading || 0

    // 1. Lead-in: Smooth ramp from current pose into start of gait cycle
    const firstGaitPose = rawCyclePoses[0] || DEFAULT_POSE
    for (let i = 0; i < leadInSteps; i++) {
        const t = quinticEase(i / leadInSteps)
        frames.push({
            pose: blendTwoPoses(startPose, firstGaitPose, t),
            twist: baseHeading,
        })
    }

    // 2. Steady state: Exact 60 FPS cyclic locomotion with zero foot slipping
    const totalStepsInCycle = rawCyclePoses.length
    for (let i = 0; i < steadyFramesCount; i++) {
        const steadyProgress = i / (steadyFramesCount - 1)
        const cycleProgress = (steadyProgress * totalCycles) % 1.0
        const floatIndex = cycleProgress * totalStepsInCycle
        const idx0 = Math.floor(floatIndex) % totalStepsInCycle
        const idx1 = (idx0 + 1) % totalStepsInCycle
        const intraStepT = floatIndex - Math.floor(floatIndex)

        const blendedPose = blendTwoPoses(rawCyclePoses[idx0], rawCyclePoses[idx1], intraStepT)
        const currentTwist = isRotate ? (baseHeading + totalRotationDeg * steadyProgress) : baseHeading

        frames.push({
            pose: blendedPose,
            twist: currentTwist,
        })
    }

    // 3. Lead-out: Return to stance while holding final achieved heading
    const finalHeading = isRotate ? (baseHeading + totalRotationDeg) : baseHeading
    const lastGaitPose = frames[frames.length - 1]?.pose || DEFAULT_POSE
    for (let i = 1; i <= leadOutSteps; i++) {
        const t = quinticEase(i / leadOutSteps)
        frames.push({
            pose: blendTwoPoses(lastGaitPose, DEFAULT_POSE, t),
            twist: finalHeading,
        })
    }

    return frames
}