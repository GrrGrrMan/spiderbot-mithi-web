// web-ui/src/hexapod/solvers/motionSynthesizer.js
import solveInverseKinematics from "./ik/hexapodSolver"
import getWalkSequence from "./walkSequenceSolver"
import { ZERO_POSE } from "../constants"
import { DEFAULT_GAIT_PARAMS } from "../../templates"

const DEFAULT_POSE = ZERO_POSE

export function quinticEase(t) {
    return t * t * t * (t * (t * 6 - 15) + 10)
}

function blendTwoPoses(startPose, targetPose, t) {
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
            resolve(buildSequenceFromKeyframes(keyframes, stepsPerTransition))
            return
        }
        const id = jobCounter++
        pendingJobs.set(id, { resolve, reject })
        worker.postMessage({ id, keyframes, stepsPerTransition })
    })
}

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

    if (presetName === "wave" || presetName === "waveLeg" || presetName === "sayHi" || presetName === "preset_wave") {
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

    } else if (presetName === "doubleWave" || presetName === "cheer" || presetName === "preset_cheer") {
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

    } else if (presetName === "standUp" || presetName === "preset_stand") {
        const tallPose = getIkPose(dimensions, { tx: 0, ty: 0, tz: 0.35, rx: 0, ry: 0, rz: 0, hipStance: 25, legStance: 10 })
        keyframes.push(startPose)
        keyframes.push(tallPose)

    } else if (presetName === "sitDown" || presetName === "preset_sit") {
        const lowPose = getIkPose(dimensions, { tx: 0, ty: 0, tz: -0.4, rx: 0, ry: 0, rz: 0, hipStance: 20, legStance: 0 })
        keyframes.push(startPose)
        keyframes.push(lowPose)

    } else if (presetName === "bow" || presetName === "preset_bow") {
        const bowForward = getIkPose(dimensions, { tx: 0, ty: 0.1, tz: -0.15, rx: 0, ry: 25, rz: 0, hipStance: 20, legStance: 0 })
        const bowBack = getIkPose(dimensions, { tx: 0, ty: -0.05, tz: 0, rx: 0, ry: -10, rz: 0, hipStance: 20, legStance: 0 })
        keyframes.push(startPose)
        keyframes.push(bowForward)
        keyframes.push(bowForward)
        keyframes.push(bowBack)
        keyframes.push(DEFAULT_POSE)

    } else if (presetName === "danceWiggle" || presetName === "dance" || presetName === "preset_dance") {
        keyframes.push(startPose)
        for (let c = 0; c < count; c++) {
            const h1 = getIkPose(dimensions, { tx: 0.15, ty: 0, tz: 0.1, rx: 18, ry: 12, rz: 22, hipStance: 22, legStance: 5 })
            const h2 = getIkPose(dimensions, { tx: -0.15, ty: 0, tz: -0.1, rx: -18, ry: -12, rz: -22, hipStance: 22, legStance: 5 })
            keyframes.push(h1)
            keyframes.push(h2)
        }
        keyframes.push(DEFAULT_POSE)

    } else if (presetName === "twistAndLook" || presetName === "lookAround" || presetName === "preset_look_around") {
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

    } else if (presetName === "pushups" || presetName === "preset_pushups") {
        const pushDown = getIkPose(dimensions, { tx: 0, ty: 0, tz: -0.45, rx: 0, ry: 10, rz: 0, hipStance: 18, legStance: -5 })
        const pushUp = getIkPose(dimensions, { tx: 0, ty: 0, tz: 0.25, rx: 0, ry: -5, rz: 0, hipStance: 25, legStance: 10 })
        keyframes.push(startPose)
        for (let c = 0; c < count; c++) {
            keyframes.push(pushDown)
            keyframes.push(pushUp)
        }
        keyframes.push(DEFAULT_POSE)

    } else if (presetName === "stretch" || presetName === "preset_stretch") {
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

export function generatePresetFrames(presetName, dimensions, cycles = 3, startPose = DEFAULT_POSE, stepsPerTransition = 10) {
    const keyframes = generatePresetKeyframes(presetName, dimensions, cycles, startPose)
    return buildSequenceFromKeyframes(keyframes, stepsPerTransition)
}

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
        // Drop duplicate wrap-around boundary frame to prevent seam stutter
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

/**
 * Synthesizes walking and turning gait frames with true 3D body rotation
 */
export async function generateParametricPoseFramesAsync(motionPayload, dimensions, startPose = DEFAULT_POSE, steps = 15) {
    const p = motionPayload || {}
    const tx = (p.pos_x || p.tx || 0) / 100.0
    const ty = -(p.pos_y || p.ty || 0) / 100.0
    const tz = (p.pos_z || p.tz || 0) / 132.0
    const rx = -(p.roll || p.rx || 0)
    const ry = -(p.pitch || p.ry || 0)
    const rz = -(p.yaw || p.rz || 0)
    const hipStance = p.hip_stance !== undefined ? p.hip_stance : 20
    const legStance = p.leg_stance !== undefined ? p.leg_stance : 0

    const targetPose = getIkPose(dimensions, { tx, ty, tz, rx, ry, rz, hipStance, legStance })
    return buildSequenceFromKeyframesAsync([startPose, targetPose], steps)
}

export async function generateLocomotionFrames(actionId, dimensions, durationMs = 3000, startPose = DEFAULT_POSE, customGaitParams = null) {
    const isSpin = actionId === "spin"
    const isTurnLeft = actionId === "turn_left"
    const isTurnRight = actionId === "turn_right"
    const isRotate = isSpin || isTurnLeft || isTurnRight
    const walkMode = isRotate ? "rotating" : "walking"
    const isBackward = actionId === "walk_backward"

    const gaitParams = {
        ...DEFAULT_GAIT_PARAMS,
        hipSwing: isSpin ? 35 : 25,
        liftSwing: customGaitParams?.step_height || 38,
        stepCount: 5,
        ...(customGaitParams || {}),
    }

    const walkSeq = getWalkSequence(dimensions, gaitParams, "tripod", walkMode)
    if (!walkSeq) return [{ pose: startPose, twist: 0 }, { pose: DEFAULT_POSE, twist: 0 }]

    // 1 loop stride cycle ≈ 1.0s. Calculate continuous loop count for exact duration
    const loops = Math.max(1, Math.round(durationMs / 1000))
    const rawPoses = expandGaitSequence(walkSeq, 3, loops)

    if (isBackward) {
        rawPoses.reverse()
    }

    const totalSteps = rawPoses.length
    const frames = []

    // 1. Smooth lead-in blend from starting stance
    const leadInSteps = 4
    for (let i = 0; i <= leadInSteps; i++) {
        const t = i / leadInSteps
        const ease = quinticEase(t)
        frames.push({
            pose: blendTwoPoses(startPose, rawPoses[0], ease),
            twist: 0
        })
    }

    // 2. Active Locomotion (Tripod Kinematics keep feet grounded naturally)
    for (let i = 0; i < totalSteps; i++) {
        frames.push({
            pose: rawPoses[i],
            twist: 0
        })
    }

    // 3. Smooth lead-out blend to neutral standing pose
    const leadOutSteps = 4
    const lastPose = rawPoses[rawPoses.length - 1] || DEFAULT_POSE
    for (let i = 1; i <= leadOutSteps; i++) {
        const t = i / leadOutSteps
        const ease = quinticEase(t)
        frames.push({
            pose: blendTwoPoses(lastPose, DEFAULT_POSE, ease),
            twist: 0
        })
    }

    return frames
}

export async function generateDynamicSequenceFramesAsync(keyframes, dimensions, startPose = DEFAULT_POSE) {
    if (!keyframes || !Array.isArray(keyframes) || keyframes.length === 0) {
        return [startPose, DEFAULT_POSE]
    }

    const LEG_KEYS = {
        rf: "rightFront",
        rm: "rightMiddle",
        rr: "rightBack",
        lr: "leftBack",
        lm: "leftMiddle",
        lf: "leftFront",
    }

    const convertedPoses = []
    convertedPoses.push(startPose)

    for (let i = 0; i < keyframes.length; i++) {
        const kf = keyframes[i]
        let framePose = JSON.parse(JSON.stringify(DEFAULT_POSE))

        // A. Body Cartesian IK Keyframe
        if (kf.tx !== undefined || kf.ty !== undefined || kf.tz !== undefined || kf.rx !== undefined || kf.ry !== undefined || kf.rz !== undefined) {
            framePose = getIkPose(dimensions, {
                tx: (kf.tx || 0) / 100.0,
                ty: (kf.ty || 0) / 100.0,
                tz: (kf.tz || 0) / 132.0,
                // INVERT ROTATIONS to perfectly match ESP32-S3 Firmware (SequencePoser.cpp)
                rx: -(kf.rx || 0),
                ry: -(kf.ry || 0),
                rz: -(kf.rz || 0),
                hipStance: 20,
                legStance: 0,
            })
        }

        // B. Joint Overrides (e.g. waving front leg)
        if (kf.joints && typeof kf.joints === "object") {
            // Carry over previous frame's pose so untouched legs don't instantly snap to 0
            const lastPose = convertedPoses[convertedPoses.length - 1] || DEFAULT_POSE
            framePose = JSON.parse(JSON.stringify(lastPose))
            
            Object.entries(kf.joints).forEach(([shortKey, angles]) => {
                const fullLegName = LEG_KEYS[shortKey] || shortKey
                if (framePose[fullLegName]) {
                    framePose[fullLegName] = {
                        alpha: angles.alpha !== undefined ? angles.alpha : framePose[fullLegName].alpha,
                        beta: angles.beta !== undefined ? angles.beta : framePose[fullLegName].beta,
                        gamma: angles.gamma !== undefined ? angles.gamma : framePose[fullLegName].gamma,
                    }
                }
            })
        }

        convertedPoses.push(framePose)
    }

    // Return to neutral stance at the end of gesture
    convertedPoses.push(DEFAULT_POSE)

    return await buildSequenceFromKeyframesAsync(convertedPoses, 15)
}
