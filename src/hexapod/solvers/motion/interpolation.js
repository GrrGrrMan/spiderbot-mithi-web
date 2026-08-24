// src/hexapod/solvers/motion/interpolation.js
import { ZERO_POSE } from "../../constants"

export const DEFAULT_POSE = ZERO_POSE

export function quinticEase(t) {
    return t * t * t * (t * (t * 6 - 15) + 10)
}

export function blendTwoPoses(startPose, targetPose, t) {
    const pose = {}
    const legs = ["leftFront", "rightFront", "leftMiddle", "rightMiddle", "leftBack", "rightBack"]
    const defaultLeg = { alpha: 0, beta: 0, gamma: 0 }
    legs.forEach(leg => {
        const s = (startPose && startPose[leg]) || defaultLeg
        const target = (targetPose && targetPose[leg]) || defaultLeg
        pose[leg] = {
            alpha: (s.alpha || 0) + ((target.alpha || 0) - (s.alpha || 0)) * t,
            beta: (s.beta || 0) + ((target.beta || 0) - (s.beta || 0)) * t,
            gamma: (s.gamma || 0) + ((target.gamma || 0) - (s.gamma || 0)) * t,
        }
    })
    return pose
}

export function interpolatePoses(startPose, targetPose, steps = 10) {
    const frames = []
    for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 1 : i / steps
        const ease = quinticEase(t)
        frames.push(blendTwoPoses(startPose, targetPose, ease))
    }
    return frames
}

export function buildSequenceFromKeyframes(keyframes, stepsPerTransition = 10) {
    if (!keyframes || keyframes.length === 0) return [DEFAULT_POSE]
    if (keyframes.length === 1) {
        const steps = Array.isArray(stepsPerTransition) ? (stepsPerTransition[0] || 10) : stepsPerTransition
        return interpolatePoses(DEFAULT_POSE, keyframes[0], steps)
    }

    let fullSequence = []
    for (let i = 0; i < keyframes.length - 1; i++) {
        const steps = Array.isArray(stepsPerTransition) ? (stepsPerTransition[i] || 10) : stepsPerTransition
        const seg = interpolatePoses(keyframes[i], keyframes[i + 1], steps)
        if (i > 0) seg.shift()
        fullSequence = fullSequence.concat(seg)
    }
    return fullSequence
}