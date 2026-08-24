// web-ui/src/hooks/useAiMotionExecutor.js
import { useState, useRef, useCallback, useEffect } from "react"
import { DEFAULT_POSE, DEFAULT_DIMENSIONS } from "../templates"
import { buildServoBatchPayload } from "../utils/servoMapper"
import { 
    generatePresetFramesAsync, 
    generateLocomotionFrames, 
    generateDynamicSequenceFramesAsync,
    generateParametricPoseFramesAsync
} from "../hexapod/solvers/motionSynthesizer"
import { usePoseFrameStream } from "./usePoseFrameStream"

export const useAiMotionExecutor = ({ params = {}, publishImmediate = () => {}, publishAudio = () => {}, onUpdate = () => {} }) => {
    const [activeFrames, setActiveFrames] = useState([])
    const [activeExecutingAction, setActiveExecutingAction] = useState(null)
    const activeReqIdRef = useRef(0)
    const motionTimerRef = useRef(null) // ◄ Must be inside the hook
    const motionIntervalRef = useRef(null)

    const paramsRef = useRef(params)
    paramsRef.current = params

    const stopLocomotionTimer = useCallback(() => {
        if (motionTimerRef.current) {
            clearTimeout(motionTimerRef.current)
            motionTimerRef.current = null
        }
        if (motionIntervalRef.current) {
            clearInterval(motionIntervalRef.current)
            motionIntervalRef.current = null
        }
    }, [])

    // Cleanup pending timer when component unmounts
    useEffect(() => {
        return stopLocomotionTimer
    }, [stopLocomotionTimer])

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

    const playParametricPose = useCallback(
        (motionPayload, actionName = "Custom Pose", skipPublish = false) => {
            if (!motionPayload) return
            stopStream()
            stopLocomotionTimer()
            setActiveExecutingAction(actionName)
            const reqId = ++activeReqIdRef.current
            const dims = paramsRef.current?.dimensions || DEFAULT_DIMENSIONS
            const startPose = paramsRef.current?.pose || DEFAULT_POSE

            if (!skipPublish) {
                publishImmediate("hexapod/cmd", motionPayload)
            }

            generateParametricPoseFramesAsync(motionPayload, dims, startPose, 15).then(frames => {
                if (reqId === activeReqIdRef.current && Array.isArray(frames) && frames.length > 0) {
                    setActiveFrames(frames)
                }
            })
        },
        [stopStream, stopLocomotionTimer, publishImmediate]
    )

    const playSequence = useCallback(
        (actionPayload, actionName, skipPublish = false) => {
            if (!actionPayload) return
            stopStream()
            stopLocomotionTimer()
            const name = actionName || actionPayload.name || actionPayload.preset || "gesture"
            setActiveExecutingAction(name)
            const reqId = ++activeReqIdRef.current
            const dims = paramsRef.current?.dimensions || DEFAULT_DIMENSIONS
            const startPose = paramsRef.current?.pose || DEFAULT_POSE

            if (!skipPublish) {
                publishImmediate("hexapod/cmd", actionPayload)
            }

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
        [stopStream, stopLocomotionTimer, publishImmediate]
    )

    const playLocomotion = useCallback(
        (actionId, durationMs = 3000, customGaitParams = null) => {
            stopStream()
            setActiveExecutingAction(actionId)
            const reqId = ++activeReqIdRef.current
            const dims = paramsRef.current?.dimensions || DEFAULT_DIMENSIONS
            const startPose = paramsRef.current?.pose || DEFAULT_POSE

            generateLocomotionFrames(actionId, dims, durationMs, startPose, customGaitParams).then(frames => {
                if (reqId === activeReqIdRef.current && Array.isArray(frames) && frames.length > 0) {
                    setActiveFrames(frames)
                }
            })
        },
        [stopStream]
    )

    const handleSingleJoint = useCallback(
        jointParams => {
            if (!jointParams?.leg) return
            stopLocomotionTimer()
            const { leg, joint, angle = 0, mode = "relative" } = jointParams
            const jointMap = { coxa: "alpha", coxia: "alpha", femur: "beta", tibia: "gamma" }
            const angleParam = jointMap[joint] || joint

            const currentPose = paramsRef.current?.pose || DEFAULT_POSE
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
        [onUpdate, publishImmediate, stopLocomotionTimer]
    )

    const triggerAction = useCallback(
        (action, jointParams = null, options = {}) => {
            if (!action && !jointParams) return
            const skipPublish = Boolean(options.skipPublish)

            if (action === "single_joint" || action?.id === "single_joint") {
                handleSingleJoint(jointParams || action?.joint_params)
                return
            }

            const { payload, topic, duration_ms, name, id } = action

            if (topic === "audio") {
                if (!skipPublish) publishAudio(payload)
            } else if (payload?.type === "sequence" || payload?.type === "preset" || id?.startsWith("preset_")) {
                playSequence(payload, name, skipPublish)
            } else if (payload?.type === "motion") {
                stopLocomotionTimer()
                setActiveExecutingAction(name)

                const isLocomotion = (payload.vx && payload.vx !== 0) || (payload.vy && payload.vy !== 0) || (payload.omega && payload.omega !== 0)
                const isPoseOnly = !isLocomotion && (payload.pos_z !== undefined || payload.roll !== undefined || payload.pitch !== undefined || payload.yaw !== undefined || payload.hip_stance !== undefined || payload.leg_stance !== undefined)
                const effectiveDuration = payload.duration_ms || duration_ms || 3000

                if (id === "stop") {
                    stopStream()
                    setActiveExecutingAction(null)
                    if (!skipPublish) publishImmediate("hexapod/cmd", payload)
                    onUpdate("pose", { pose: DEFAULT_POSE })
                } else if (isPoseOnly) {
                    playParametricPose(payload, name, skipPublish)
                } else {
                    if (!skipPublish) {
                        publishImmediate("hexapod/cmd", payload)
                        motionIntervalRef.current = setInterval(() => {
                            publishImmediate("hexapod/cmd", payload)
                        }, 1000)
                    }

                    playLocomotion(id, effectiveDuration, payload)

                    if (effectiveDuration > 0 && !skipPublish) {
                        motionTimerRef.current = setTimeout(() => {
                            stopLocomotionTimer()
                            publishImmediate("hexapod/cmd", { ...payload, vx: 0, vy: 0, omega: 0 })
                        }, effectiveDuration)
                    }
                }
            } else {
                stopLocomotionTimer()
                setActiveExecutingAction(name)
                if (!skipPublish) publishImmediate("hexapod/cmd", payload)
            }
        },
        [publishAudio, publishImmediate, playSequence, playLocomotion, playParametricPose, stopStream, onUpdate, handleSingleJoint, stopLocomotionTimer]
    )

    const stopAll = useCallback(() => {
        stopLocomotionTimer()
        stopStream()
        activeReqIdRef.current++
        setActiveExecutingAction(null)
        setActiveFrames([])
        publishImmediate("hexapod/cmd", { type: "motion", vx: 0, vy: 0, omega: 0 })
        onUpdate("pose", { pose: DEFAULT_POSE })
    }, [stopStream, publishImmediate, onUpdate, stopLocomotionTimer])

    return { activeExecutingAction, triggerAction, stopAll }
}