// web-ui/src/hooks/useAiMotionExecutor.js
import { useState, useRef, useCallback } from "react"
import { DEFAULT_POSE, DEFAULT_DIMENSIONS } from "../templates"
import { buildServoBatchPayload } from "../utils/servoMapper"
import { 
    generatePresetFramesAsync, 
    generateLocomotionFrames, 
    generateDynamicSequenceFramesAsync 
} from "../hexapod/solvers/motionSynthesizer"
import { usePoseFrameStream } from "./usePoseFrameStream"

export const useAiMotionExecutor = ({ params = {}, publishImmediate = () => {}, publishAudio = () => {}, onUpdate = () => {} }) => {
    const [activeFrames, setActiveFrames] = useState([])
    const [activeExecutingAction, setActiveExecutingAction] = useState(null)
    const activeReqIdRef = useRef(0)

    // Local 60 FPS Visualizer (Zero MQTT Pose Spamming)
    const { stop: stopStream } = usePoseFrameStream(
        activeFrames,
        () => {}, 
        {
            onComplete: finalPose => {
                if (finalPose && typeof finalPose === "object") {
                    onUpdate("pose", { pose: finalPose })
                }
                setActiveExecutingAction(null)
            },
        }
    )

    const playSequence = useCallback(
        (actionPayload, actionName) => {
            if (!actionPayload) return
            stopStream()
            const name = actionName || actionPayload.name || actionPayload.preset || "gesture"
            setActiveExecutingAction(name)
            const reqId = ++activeReqIdRef.current
            const dims = params?.dimensions || DEFAULT_DIMENSIONS
            const startPose = params?.pose || DEFAULT_POSE

            // 1. Transmit sequence command to physical ESP32-S3 node
            publishImmediate("hexapod/cmd", actionPayload)

            // 2. Animate 3D Web-UI model dynamically
            if (actionPayload.keyframes && Array.isArray(actionPayload.keyframes)) {
                generateDynamicSequenceFramesAsync(actionPayload.keyframes, dims, startPose).then(frames => {
                    if (reqId === activeReqIdRef.current && Array.isArray(frames) && frames.length > 0) {
                        setActiveFrames(frames)
                    }
                })
            } else {
                generatePresetFramesAsync(actionPayload.preset || name, dims, 3, startPose, 30).then(frames => {
                    if (reqId === activeReqIdRef.current && Array.isArray(frames) && frames.length > 0) {
                        setActiveFrames(frames)
                    }
                })
            }
        },
        [params, stopStream, publishImmediate]
    )

    const playLocomotion = useCallback(
        (actionId, durationMs = 3000) => {
            stopStream()
            setActiveExecutingAction(actionId)
            const reqId = ++activeReqIdRef.current
            const dims = params?.dimensions || DEFAULT_DIMENSIONS
            const startPose = params?.pose || DEFAULT_POSE

            generateLocomotionFrames(actionId, dims, durationMs, startPose).then(frames => {
                if (reqId === activeReqIdRef.current && Array.isArray(frames) && frames.length > 0) {
                    setActiveFrames(frames)
                }
            })
        },
        [params, stopStream]
    )

    const handleSingleJoint = useCallback(
        jointParams => {
            if (!jointParams?.leg) return
            const { leg, joint, angle = 0, mode = "relative" } = jointParams
            const jointMap = { coxa: "alpha", coxia: "alpha", femur: "beta", tibia: "gamma" }
            const angleParam = jointMap[joint] || joint

            const currentPose = params?.pose || DEFAULT_POSE
            const currentAngle = currentPose[leg]?.[angleParam] || 0
            let targetAngle = mode === "relative" ? currentAngle + angle : angle

            if (angleParam === "alpha") targetAngle = Math.max(-40, Math.min(40, targetAngle))
            if (angleParam === "beta") targetAngle = Math.max(-80, Math.min(80, targetAngle))
            if (angleParam === "gamma") targetAngle = Math.max(-90, Math.min(90, targetAngle))

            const newPose = { ...currentPose, [leg]: { ...currentPose[leg], [angleParam]: targetAngle } }
            setActiveExecutingAction(`FK: ${leg} ${joint}`)
            onUpdate("pose", { pose: newPose })
            publishImmediate("hexapod/cmd", buildServoBatchPayload(newPose))
        },
        [params, onUpdate, publishImmediate]
    )

    const triggerAction = useCallback(
        (action, jointParams = null) => {
            if (!action && !jointParams) return

            if (action === "single_joint" || action?.id === "single_joint") {
                handleSingleJoint(jointParams || action?.joint_params)
                return
            }

            const { payload, topic, duration_ms, name, id } = action

            if (topic === "audio") {
                publishAudio(payload)
            } else if (payload?.type === "sequence" || payload?.type === "preset" || id?.startsWith("preset_")) {
                playSequence(payload, name)
            } else if (payload?.type === "motion") {
                setActiveExecutingAction(name)
                publishImmediate("hexapod/cmd", payload)
                if (id === "stop") {
                    stopStream()
                    setActiveExecutingAction(null)
                    onUpdate("pose", { pose: DEFAULT_POSE })
                } else {
                    playLocomotion(id, duration_ms || 3000)
                    if (duration_ms > 0) {
                        setTimeout(() => {
                            publishImmediate("hexapod/cmd", { ...payload, vx: 0, vy: 0, omega: 0 })
                        }, duration_ms)
                    }
                }
            } else {
                setActiveExecutingAction(name)
                publishImmediate("hexapod/cmd", payload)
            }
        },
        [publishAudio, publishImmediate, playSequence, playLocomotion, stopStream, onUpdate, handleSingleJoint]
    )

    const stopAll = useCallback(() => {
        stopStream()
        activeReqIdRef.current++
        setActiveExecutingAction(null)
        setActiveFrames([])
        publishImmediate("hexapod/cmd", { type: "motion", vx: 0, vy: 0, omega: 0 })
        onUpdate("pose", { pose: DEFAULT_POSE })
    }, [stopStream, publishImmediate, onUpdate])

    return { activeExecutingAction, triggerAction, stopAll }
}