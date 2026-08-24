// src/hexapod/solvers/motion/dynamicSequence.js
import { DEFAULT_POSE } from "./interpolation"
import { getIkPose } from "./presets"
import { buildSequenceFromKeyframesAsync } from "./workerPool"

const LEG_KEYS = {
    rf: "rightFront",
    rm: "rightMiddle",
    rr: "rightBack",
    lr: "leftBack",
    lm: "leftMiddle",
    lf: "leftFront",
}

export async function generateDynamicSequenceFramesAsync(keyframes, dimensions, startPose = DEFAULT_POSE) {
    if (!keyframes || !Array.isArray(keyframes) || keyframes.length === 0) {
        return [startPose, DEFAULT_POSE]
    }

    const convertedPoses = [startPose]

    for (let i = 0; i < keyframes.length; i++) {
        const kf = keyframes[i]
        let framePose = JSON.parse(JSON.stringify(DEFAULT_POSE))

        // Body Cartesian IK Keyframe
        if (kf.tx !== undefined || kf.ty !== undefined || kf.tz !== undefined || kf.rx !== undefined || kf.ry !== undefined || kf.rz !== undefined) {
            framePose = getIkPose(dimensions, {
                tx: (kf.tx || 0) / 100.0,
                ty: (kf.ty || 0) / 100.0,
                tz: (kf.tz || 0) / 132.0,
                rx: -(kf.rx || 0),
                ry: -(kf.ry || 0),
                rz: -(kf.rz || 0),
                hipStance: 20,
                legStance: 0,
            })
        }

        // Joint Overrides
        if (kf.joints && typeof kf.joints === "object") {
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

    convertedPoses.push(DEFAULT_POSE)
    return await buildSequenceFromKeyframesAsync(convertedPoses, 15)
}