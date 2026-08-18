// web-ui/src/hexapod/solvers/motionSynthesizer.js
import solveInverseKinematics from "./ik/hexapodSolver"
import { ZERO_POSE } from "../constants"

const DEFAULT_POSE = ZERO_POSE

/**
 * Phase 1: Quintic Minimum-Jerk polynomial interpolation.
 * s(t) = 10t^3 - 15t^4 + 6t^5
 * Guarantees zero velocity and zero acceleration at start and end.
 */
export function quinticEase(t) {
    return t * t * t * (t * (t * 6 - 15) + 10)
}

/**
 * Utility to blend between two poses with quintic easing (Main Thread Fallback)
 */
export function interpolatePoses(startPose, targetPose, steps = 10) {
    const frames = []
    const legs = ["leftFront", "rightFront", "leftMiddle", "rightMiddle", "leftBack", "rightBack"]

    for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 1 : i / steps
        const ease = quinticEase(t)
        const pose = {}

        legs.forEach(leg => {
            const sLeg = (startPose && startPose[leg]) || { alpha: 0, beta: 0, gamma: 0 }
            const tLeg = (targetPose && targetPose[leg]) || { alpha: 0, beta: 0, gamma: 0 }

            pose[leg] = {
                alpha: (sLeg.alpha || 0) + ((tLeg.alpha || 0) - (sLeg.alpha || 0)) * ease,
                beta: (sLeg.beta || 0) + ((tLeg.beta || 0) - (sLeg.beta || 0)) * ease,
                gamma: (sLeg.gamma || 0) + ((tLeg.gamma || 0) - (sLeg.gamma || 0)) * ease,
            }
        })
        frames.push(pose)
    }
    return frames
}

/**
 * Builds a smooth frame sequence from an array of keyframe poses (Main Thread)
 */
export function buildSequenceFromKeyframes(keyframes, stepsPerTransition = 10) {
    if (!keyframes || keyframes.length === 0) return [DEFAULT_POSE]
    if (keyframes.length === 1) return interpolatePoses(DEFAULT_POSE, keyframes[0], stepsPerTransition)

    let fullSequence = []
    for (let i = 0; i < keyframes.length - 1; i++) {
        const seg = interpolatePoses(keyframes[i], keyframes[i + 1], stepsPerTransition)
        if (i > 0) seg.shift()
        fullSequence = fullSequence.concat(seg)
    }
    return fullSequence
}

// -----------------------------------------------------------------------------
// WEB WORKER: Asynchronous Trajectory Offloading
// -----------------------------------------------------------------------------
let workerInstance = null
let jobCounter = 0
const pendingJobs = new Map()

function getWorker() {
    // Only spin up the worker in browser environments (protects Jest test runs)
    if (!workerInstance && typeof window !== "undefined" && window.Worker) {
        const workerCode = `
            function quinticEase(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
            function interpolatePoses(startPose, targetPose, steps) {
                const frames = [];
                const legs = ["leftFront", "rightFront", "leftMiddle", "rightMiddle", "leftBack", "rightBack"];
                const defaultLeg = { alpha: 0, beta: 0, gamma: 0 };
                for (let i = 0; i <= steps; i++) {
                    const t = steps === 0 ? 1 : i / steps;
                    const ease = quinticEase(t);
                    const pose = {};
                    legs.forEach(leg => {
                        const sLeg = (startPose && startPose[leg]) || defaultLeg;
                        const tLeg = (targetPose && targetPose[leg]) || defaultLeg;
                        pose[leg] = {
                            alpha: sLeg.alpha + (tLeg.alpha - sLeg.alpha) * ease,
                            beta: sLeg.beta + (tLeg.beta - sLeg.beta) * ease,
                            gamma: sLeg.gamma + (tLeg.gamma - sLeg.gamma) * ease,
                        };
                    });
                    frames.push(pose);
                }
                return frames;
            }
            function buildSequenceFromKeyframes(keyframes, stepsPerTransition) {
                if (!keyframes || keyframes.length === 0) return [];
                if (keyframes.length === 1) return interpolatePoses(null, keyframes[0], stepsPerTransition);
                let fullSequence = [];
                for (let i = 0; i < keyframes.length - 1; i++) {
                    const seg = interpolatePoses(keyframes[i], keyframes[i + 1], stepsPerTransition);
                    if (i > 0) seg.shift();
                    fullSequence = fullSequence.concat(seg);
                }
                return fullSequence;
            }
            self.onmessage = function(e) {
                const { id, keyframes, stepsPerTransition } = e.data;
                const frames = buildSequenceFromKeyframes(keyframes, stepsPerTransition);
                self.postMessage({ id, frames });
            };
        `;
        const blob = new Blob([workerCode], { type: "application/javascript" })
        workerInstance = new Worker(URL.createObjectURL(blob))
        workerInstance.onmessage = e => {
            const { id, frames } = e.data
            if (pendingJobs.has(id)) {
                pendingJobs.get(id).resolve(frames)
                pendingJobs.delete(id)
            }
        }
    }
    return workerInstance
}

export function buildSequenceFromKeyframesAsync(keyframes, stepsPerTransition = 10) {
    return new Promise((resolve, reject) => {
        const worker = getWorker()
        if (!worker) {
            // Fallback for Jest/tests that don't have Blob Worker support
            resolve(buildSequenceFromKeyframes(keyframes, stepsPerTransition))
            return
        }
        const id = jobCounter++
        pendingJobs.set(id, { resolve, reject })
        worker.postMessage({ id, keyframes, stepsPerTransition })
    })
}

/**
 * Helper to solve IK pose safely
 */
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

/**
 * Defines the critical keyframes. Decoupled from the interpolator loop so 
 * IK solves happen synchronously, but frame-generation is Async.
 */
export function generatePresetKeyframes(presetName, dimensions, cycles = 3, startPose = DEFAULT_POSE) {
    const keyframes = []
    const count = Math.max(1, Math.min(cycles || 3, 10))

    if (presetName === "wave" || presetName === "waveLeg" || presetName === "sayHi") {
        const waveLift = JSON.parse(JSON.stringify(DEFAULT_POSE))
        waveLift.rightFront = { alpha: 25, beta: 65, gamma: -60 }

        const waveLeft = JSON.parse(JSON.stringify(DEFAULT_POSE))
        waveLeft.rightFront = { alpha: -25, beta: 65, gamma: -60 }

        const waveRight = JSON.parse(JSON.stringify(DEFAULT_POSE))
        waveRight.rightFront = { alpha: 35, beta: 65, gamma: -60 }

        keyframes.push(startPose)
        keyframes.push(waveLift)
        for (let c = 0; c < count; c++) {
            keyframes.push(waveLeft)
            keyframes.push(waveRight)
        }
        keyframes.push(waveLift)
        keyframes.push(DEFAULT_POSE)

    } else if (presetName === "doubleWave" || presetName === "cheer") {
        const cheerUp1 = JSON.parse(JSON.stringify(DEFAULT_POSE))
        cheerUp1.leftFront = { alpha: -20, beta: 60, gamma: -50 }
        cheerUp1.rightFront = { alpha: 20, beta: 60, gamma: -50 }

        const cheerUp2 = JSON.parse(JSON.stringify(DEFAULT_POSE))
        cheerUp2.leftFront = { alpha: -35, beta: 75, gamma: -70 }
        cheerUp2.rightFront = { alpha: 35, beta: 75, gamma: -70 }

        keyframes.push(startPose)
        for (let c = 0; c < count; c++) {
            keyframes.push(cheerUp1)
            keyframes.push(cheerUp2)
        }
        keyframes.push(DEFAULT_POSE)

    } else if (presetName === "standUp") {
        const tallPose = getIkPose(dimensions, { tx: 0, ty: 0, tz: 0.35, rx: 0, ry: 0, rz: 0, hipStance: 25, legStance: 10 })
        keyframes.push(startPose)
        keyframes.push(tallPose)

    } else if (presetName === "sitDown") {
        const lowPose = getIkPose(dimensions, { tx: 0, ty: 0, tz: -0.4, rx: 0, ry: 0, rz: 0, hipStance: 20, legStance: 0 })
        keyframes.push(startPose)
        keyframes.push(lowPose)

    } else if (presetName === "bow") {
        const bowForward = getIkPose(dimensions, { tx: 0, ty: 0.1, tz: -0.15, rx: 0, ry: 25, rz: 0, hipStance: 20, legStance: 0 })
        const bowBack = getIkPose(dimensions, { tx: 0, ty: -0.05, tz: 0, rx: 0, ry: -10, rz: 0, hipStance: 20, legStance: 0 })
        keyframes.push(startPose)
        keyframes.push(bowForward)
        keyframes.push(bowForward) // Hold bow
        keyframes.push(bowBack)
        keyframes.push(DEFAULT_POSE)

    } else if (presetName === "danceWiggle" || presetName === "dance") {
        keyframes.push(startPose)
        for (let c = 0; c < count; c++) {
            const h1 = getIkPose(dimensions, { tx: 0.15, ty: 0, tz: 0.1, rx: 18, ry: 12, rz: 22, hipStance: 22, legStance: 5 })
            const h2 = getIkPose(dimensions, { tx: -0.15, ty: 0, tz: -0.1, rx: -18, ry: -12, rz: -22, hipStance: 22, legStance: 5 })
            keyframes.push(h1)
            keyframes.push(h2)
        }
        keyframes.push(DEFAULT_POSE)

    } else if (presetName === "twistAndLook" || presetName === "lookAround") {
        const lookLeft = getIkPose(dimensions, { tx: 0, ty: 0, tz: 0.05, rx: -10, ry: 10, rz: 40, hipStance: 20, legStance: 0 })
        const lookRight = getIkPose(dimensions, { tx: 0, ty: 0, tz: 0.05, rx: 10, ry: 10, rz: -40, hipStance: 20, legStance: 0 })
        keyframes.push(startPose)
        for (let c = 0; c < count; c++) {
            keyframes.push(lookLeft)
            keyframes.push(lookLeft)
            keyframes.push(lookRight)
            keyframes.push(lookRight)
        }
        keyframes.push(DEFAULT_POSE)

    } else if (presetName === "pushups") {
        const pushDown = getIkPose(dimensions, { tx: 0, ty: 0, tz: -0.45, rx: 0, ry: 10, rz: 0, hipStance: 18, legStance: -5 })
        const pushUp = getIkPose(dimensions, { tx: 0, ty: 0, tz: 0.25, rx: 0, ry: -5, rz: 0, hipStance: 25, legStance: 10 })
        keyframes.push(startPose)
        for (let c = 0; c < count; c++) {
            keyframes.push(pushDown)
            keyframes.push(pushUp)
        }
        keyframes.push(DEFAULT_POSE)

    } else if (presetName === "stretch") {
        const stretchOut = getIkPose(dimensions, { tx: 0, ty: 0, tz: 0.3, rx: 15, ry: 0, rz: 0, hipStance: 35, legStance: 20 })
        const stretchSide = getIkPose(dimensions, { tx: 0, ty: 0, tz: 0.3, rx: -15, ry: 0, rz: 0, hipStance: 35, legStance: 20 })
        keyframes.push(startPose)
        keyframes.push(stretchOut)
        keyframes.push(stretchSide)
        keyframes.push(DEFAULT_POSE)

    } else {
        keyframes.push(startPose)
        keyframes.push(DEFAULT_POSE)
    }
    return keyframes
}

/**
 * Sync version for testing fallback
 */
export function generatePresetFrames(presetName, dimensions, cycles = 3, startPose = DEFAULT_POSE, stepsPerTransition = 10) {
    const keyframes = generatePresetKeyframes(presetName, dimensions, cycles, startPose)
    return buildSequenceFromKeyframes(keyframes, stepsPerTransition)
}

/**
 * Main UI version: generates keyframes then offloads quintic interpolation to Web Worker.
 */
export async function generatePresetFramesAsync(presetName, dimensions, cycles = 3, startPose = DEFAULT_POSE, stepsPerTransition = 30) {
    const keyframes = generatePresetKeyframes(presetName, dimensions, cycles, startPose)
    return await buildSequenceFromKeyframesAsync(keyframes, stepsPerTransition)
}

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
        repeatedPoses = repeatedPoses.concat(rawPoses)
    }

    let smoothFrames = []
    for (let i = 0; i < repeatedPoses.length - 1; i++) {
        const sub = interpolatePoses(repeatedPoses[i], repeatedPoses[i + 1], stepsPerFrame)
        if (i > 0) sub.shift()
        smoothFrames = smoothFrames.concat(sub)
    }
    return smoothFrames
}