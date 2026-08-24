// src/hexapod/solvers/motion/workerPool.js
import { buildSequenceFromKeyframes } from "./interpolation"

let workerInstance = null
let jobCounter = 0
const pendingJobs = new Map()

export function getWorker() {
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
                if (keyframes.length === 1) {
                    const steps = Array.isArray(stepsPerTransition) ? (stepsPerTransition[0] || 10) : stepsPerTransition;
                    return interpolatePoses(null, keyframes[0], steps);
                }
                let fullSequence = [];
                for (let i = 0; i < keyframes.length - 1; i++) {
                    const steps = Array.isArray(stepsPerTransition) ? (stepsPerTransition[i] || 10) : stepsPerTransition;
                    const seg = interpolatePoses(keyframes[i], keyframes[i + 1], steps);
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
        `
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