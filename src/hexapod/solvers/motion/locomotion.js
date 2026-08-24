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
        hipSwing: isSpin ? 35 : 25,
        liftSwing: customGaitParams?.step_height || 38,
        stepCount: 5,
        ...(customGaitParams || {}),
    }

    const walkSeq = getWalkSequence(dimensions, gaitParams, "tripod", walkMode)
    if (!walkSeq) return [{ pose: startPose, twist: initialHeading }, { pose: DEFAULT_POSE, twist: initialHeading }]

    // Extract cyclic discrete poses
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

    // MITHI'S EXACT KINEMATIC COUPLING:
    // Twist exactly maps to discrete pose index
    const deltaTwist = (gaitParams.hipSwing * 2) / cyclePoseCount

    const isForward = !(isBackward || (isRotate && isTurnRight && !isSpin))
    const twistDir = isRotate ? (isForward ? 1 : -1) : 0
    const poseDir = isForward ? 1 : -1

    // Framerate targeting
    const totalTargetFrames = Math.max(30, Math.round((durationMs / 1000) * 60))
    const cycleTimeS = customGaitParams?.cycle_time || 0.8
    const framesPerCycle = Math.round(cycleTimeS * 60)

    const leadInSteps = 10
    const leadOutSteps = 10
    const steadyFramesCount = Math.max(10, totalTargetFrames - leadInSteps - leadOutSteps)

    const frames = []
    const baseHeading = initialHeading || 0

    // 1. Lead-in
    const firstGaitIdx = isForward ? 0 : cyclePoseCount - 1
    const firstGaitPose = rawCyclePoses[firstGaitIdx] || DEFAULT_POSE
    for (let i = 0; i < leadInSteps; i++) {
        const t = quinticEase(i / leadInSteps)
        frames.push({
            pose: blendTwoPoses(startPose, firstGaitPose, t),
            twist: baseHeading,
        })
    }

    // 2. Steady State
    let finalHeading = baseHeading
    let lastGaitPose = firstGaitPose
    for (let i = 0; i < steadyFramesCount; i++) {
        const stepsAdvanced = i * (cyclePoseCount / framesPerCycle)
        const currentTwist = baseHeading + (stepsAdvanced * deltaTwist * twistDir)

        let floatIndex = (stepsAdvanced * poseDir) % cyclePoseCount
        if (floatIndex < 0) floatIndex += cyclePoseCount // wrap negative to positive array indices

        const idx0 = Math.floor(floatIndex) % cyclePoseCount
        const idx1 = (idx0 + 1) % cyclePoseCount
        const t = floatIndex - Math.floor(floatIndex)

        const blendedPose = blendTwoPoses(rawCyclePoses[idx0], rawCyclePoses[idx1], t)

        frames.push({
            pose: blendedPose,
            twist: currentTwist,
        })
        finalHeading = currentTwist
        lastGaitPose = blendedPose
    }

    // 3. Lead-out
    for (let i = 1; i <= leadOutSteps; i++) {
        const t = quinticEase(i / leadOutSteps)
        frames.push({
            pose: blendTwoPoses(lastGaitPose, DEFAULT_POSE, t),
            twist: finalHeading,
        })
    }

    return frames
}