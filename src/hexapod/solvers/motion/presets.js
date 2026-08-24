// src/hexapod/solvers/motion/presets.js
import solveInverseKinematics from "../ik/hexapodSolver"
import { DEFAULT_POSE, buildSequenceFromKeyframes } from "./interpolation"
import { buildSequenceFromKeyframesAsync } from "./workerPool"

export function getIkPose(dimensions, ikParams) {
    try {
        const result = solveInverseKinematics(dimensions, ikParams)
        if (result && result.obtainedSolution && result.hexapod && result.hexapod.pose) {
            return result.hexapod.pose
        }
    } catch (e) {
        console.warn("MotionSynthesizer IK solve warning:", e)
    }
    return DEFAULT_POSE
}

export function generatePresetKeyframes(presetName, dimensions, cycles = 3, startPose = DEFAULT_POSE) {
    const keyframes = []
    const count = Math.max(1, Math.min(cycles || 3, 10))
    const base = JSON.parse(JSON.stringify(startPose || DEFAULT_POSE))

    if (presetName === "wave" || presetName === "waveLeg" || presetName === "sayHi" || presetName === "preset_wave") {
        const waveLift = JSON.parse(JSON.stringify(base))
        waveLift.rightFront = { alpha: 25, beta: 65, gamma: -60 }

        const waveLeft = JSON.parse(JSON.stringify(base))
        waveLeft.rightFront = { alpha: -25, beta: 65, gamma: -60 }

        const waveRight = JSON.parse(JSON.stringify(base))
        waveRight.rightFront = { alpha: 35, beta: 65, gamma: -60 }

        keyframes.push(startPose, waveLift)
        for (let c = 0; c < count; c++) {
            keyframes.push(waveLeft, waveRight)
        }
        keyframes.push(waveLift, base)

    } else if (presetName === "doubleWave" || presetName === "cheer" || presetName === "preset_cheer") {
        const cheerUp1 = JSON.parse(JSON.stringify(base))
        cheerUp1.leftFront = { alpha: -20, beta: 60, gamma: -50 }
        cheerUp1.rightFront = { alpha: 20, beta: 60, gamma: -50 }

        const cheerUp2 = JSON.parse(JSON.stringify(base))
        cheerUp2.leftFront = { alpha: -35, beta: 75, gamma: -70 }
        cheerUp2.rightFront = { alpha: 35, beta: 75, gamma: -70 }

        keyframes.push(startPose)
        for (let c = 0; c < count; c++) {
            keyframes.push(cheerUp1, cheerUp2)
        }
        keyframes.push(base)

    } else if (presetName === "standUp" || presetName === "preset_stand") {
        keyframes.push(startPose, getIkPose(dimensions, { tx: 0, ty: 0, tz: 0.35, rx: 0, ry: 0, rz: 0, hipStance: 25, legStance: 10 }))

    } else if (presetName === "sitDown" || presetName === "preset_sit") {
        keyframes.push(startPose, getIkPose(dimensions, { tx: 0, ty: 0, tz: -0.4, rx: 0, ry: 0, rz: 0, hipStance: 20, legStance: 0 }))

    } else if (presetName === "bow" || presetName === "preset_bow") {
        const bowForward = getIkPose(dimensions, { tx: 0, ty: 0.1, tz: -0.15, rx: 0, ry: 25, rz: 0, hipStance: 20, legStance: 0 })
        const bowBack = getIkPose(dimensions, { tx: 0, ty: -0.05, tz: 0, rx: 0, ry: -10, rz: 0, hipStance: 20, legStance: 0 })
        keyframes.push(startPose, bowForward, bowForward, bowBack, DEFAULT_POSE)

    } else if (presetName === "danceWiggle" || presetName === "dance" || presetName === "preset_dance") {
        keyframes.push(startPose)
        for (let c = 0; c < count; c++) {
            const h1 = getIkPose(dimensions, { tx: 0.15, ty: 0, tz: 0.1, rx: 18, ry: 12, rz: 22, hipStance: 22, legStance: 5 })
            const h2 = getIkPose(dimensions, { tx: -0.15, ty: 0, tz: -0.1, rx: -18, ry: -12, rz: -22, hipStance: 22, legStance: 5 })
            keyframes.push(h1, h2)
        }
        keyframes.push(DEFAULT_POSE)

    } else if (presetName === "twistAndLook" || presetName === "lookAround" || presetName === "preset_look_around") {
        const lookLeft = getIkPose(dimensions, { tx: 0, ty: 0, tz: 0.05, rx: -10, ry: 10, rz: 40, hipStance: 20, legStance: 0 })
        const lookRight = getIkPose(dimensions, { tx: 0, ty: 0, tz: 0.05, rx: 10, ry: 10, rz: -40, hipStance: 20, legStance: 0 })
        keyframes.push(startPose)
        for (let c = 0; c < count; c++) {
            keyframes.push(lookLeft, lookLeft, lookRight, lookRight)
        }
        keyframes.push(DEFAULT_POSE)

    } else if (presetName === "pushups" || presetName === "preset_pushups") {
        const pushDown = getIkPose(dimensions, { tx: 0, ty: 0, tz: -0.45, rx: 0, ry: 10, rz: 0, hipStance: 18, legStance: -5 })
        const pushUp = getIkPose(dimensions, { tx: 0, ty: 0, tz: 0.25, rx: 0, ry: -5, rz: 0, hipStance: 25, legStance: 10 })
        keyframes.push(startPose)
        for (let c = 0; c < count; c++) {
            keyframes.push(pushDown, pushUp)
        }
        keyframes.push(DEFAULT_POSE)

    } else if (presetName === "stretch" || presetName === "preset_stretch") {
        const stretchOut = getIkPose(dimensions, { tx: 0, ty: 0, tz: 0.3, rx: 15, ry: 0, rz: 0, hipStance: 35, legStance: 20 })
        const stretchSide = getIkPose(dimensions, { tx: 0, ty: 0, tz: 0.3, rx: -15, ry: 0, rz: 0, hipStance: 35, legStance: 20 })
        keyframes.push(startPose, stretchOut, stretchSide, DEFAULT_POSE)

    } else {
        keyframes.push(startPose, DEFAULT_POSE)
    }
    return keyframes
}

export function generatePresetFrames(presetName, dimensions, cycles = 3, startPose = DEFAULT_POSE, stepsPerTransition = 10) {
    const keyframes = generatePresetKeyframes(presetName, dimensions, cycles, startPose)
    return buildSequenceFromKeyframes(keyframes, stepsPerTransition)
}

export async function generatePresetFramesAsync(presetName, dimensions, cycles = 3, startPose = DEFAULT_POSE, stepsPerTransition = 30) {
    const keyframes = generatePresetKeyframes(presetName, dimensions, cycles, startPose)
    return await buildSequenceFromKeyframesAsync(keyframes, stepsPerTransition)
}