// web-ui/src/components/pages/JudgementPanel.js
import React, { useState, useEffect, useCallback, useRef } from "react"
import { SECTION_NAMES } from "../vars"
import { useContinuousWakeWord } from "../../hooks/useContinuousWakeWord"
import { useAiMotionExecutor } from "../../hooks/useAiMotionExecutor"
import { resolveAction } from "../../utils/aiActionResolver"
import DualStageViewport from "../camera/DualStageViewport"
import { SentinelStatusCard } from "../ai/SentinelStatusCard"
import { matchAction } from "../../utils/aiActionMatcher"
import AI_ACTIONS from "../../constants/aiActions.json"

const ACTIONS = AI_ACTIONS.actions
const msgKey = m => `${m.role}|${m.type}|${m.content || m.action_id || m.action || ""}`

const JudgementPanel = ({
    publishImmediate = () => {},
    publishAi = () => {},
    publishAudio = () => {},
    isConnected = false,
    camConfig = null,
    camTelemetry = null,
    hexapod = null,
    revision = 0,
    aiStatus = null,
    audioStatus = null,
    aiMessages = [],
    params = {},
    onUpdate = () => {},
    onMount = () => {},
}) => {
    const [actionLog, setActionLog] = useState([])
    const lastDirectiveKeyRef = useRef(null)
    const lastProcessedMsgRef = useRef(null)

    const aiOnline = Boolean(aiStatus && aiStatus.state !== "offline" && aiStatus.state !== "error")

    // 1. Shared Kinematics & Motion Executor
    const { triggerAction } = useAiMotionExecutor({
        params,
        publishImmediate,
        publishAudio,
        onUpdate,
    })

    const speakFeedback = useCallback(text => {
        if (!aiOnline && "speechSynthesis" in window) {
            window.speechSynthesis.cancel()
            const utterance = new SpeechSynthesisUtterance(text)
            utterance.rate = 1.05
            utterance.pitch = 1.0
            window.speechSynthesis.speak(utterance)
        }
    }, [aiOnline])

    // 2. 24/7 Wake-Word Voice Command Handler
    const handleVoiceCommand = useCallback(
        (commandText, fullUtterance) => {
            const entry = {
                id: Date.now(),
                time: new Date().toLocaleTimeString(),
                full: fullUtterance,
                command: commandText,
            }
            setActionLog(prev => [entry, ...prev.slice(0, 20)])

            // Online: Route to Pi-Hub (Pi-Hub pipeline manages intent, LLM ordering, and timing)
            if (aiOnline) {
                publishAi({
                    type: "text",
                    role: "user",
                    content: commandText,
                })
                return
            }

            // Offline Fallback
            const matchedAction = matchAction(commandText, ACTIONS)
            if (matchedAction) {
                speakFeedback(matchedAction.reply || `Executing ${matchedAction.name}`)
                triggerAction(matchedAction)
            } else {
                speakFeedback("Command not recognized.")
            }
        },
        [aiOnline, publishAi, triggerAction, speakFeedback]
    )

    // 3. Watch for assistant directives arriving from RPi
    // Pi-Hub pipeline authoritatively manages timing; JudgementPanel executes directives immediately.
    useEffect(() => {
        if (!aiMessages || !aiMessages.length) return
        const last = aiMessages[aiMessages.length - 1]
        if (!last || (last.type !== "directive" && !last.action_id && !last.action && !last.joint_params)) {
            return
        }

        const key = `${aiMessages.length}|${msgKey(last)}`
        if (lastDirectiveKeyRef.current === key) return
        lastDirectiveKeyRef.current = key

        const a = resolveAction(last, ACTIONS)
        if (a) triggerAction(a, last.joint_params)
    }, [aiMessages, triggerAction])

    // 4. Initialize continuous wake-word sentinel
    const { isListening, wakeWordState, lastTranscript, lastAcceptedCommand, micError, filterAndDispatch } =
        useContinuousWakeWord({
            onCommand: handleVoiceCommand,
            publishAi,
            aiOnline,
            audioStatus,
            enabled: true,
        })

    // 5. Bridge incoming RPi Whisper STT transcriptions to the wake-word sentinel
    useEffect(() => {
        if (!aiMessages || !aiMessages.length) return
        const lastMsg = aiMessages[aiMessages.length - 1]
        if (!lastMsg || lastMsg.type !== "transcription" || !lastMsg.content) return

        const msgId = `${lastMsg.timestamp || ""}_${lastMsg.content}`
        if (lastProcessedMsgRef.current === msgId) return
        lastProcessedMsgRef.current = msgId

        filterAndDispatch(lastMsg.content)
    }, [aiMessages, filterAndDispatch])

    useEffect(() => {
        onMount(SECTION_NAMES.judgement || "Judgement")
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
            {/* Camera & 3D Telemetry Canvas */}
            <div style={{ height: "460px", width: "100%" }}>
                <DualStageViewport
                    camConfig={camConfig}
                    camTelemetry={camTelemetry}
                    isConnected={isConnected}
                    hexapod={hexapod}
                    revision={revision}
                />
            </div>

            {/* 24/7 Passive Wake-Word Sentinel Status & History */}
            <SentinelStatusCard
                wakeWordState={wakeWordState}
                isListening={isListening}
                micError={micError}
                lastTranscript={lastTranscript}
                lastAcceptedCommand={lastAcceptedCommand}
                actionLog={actionLog}
            />
        </div>
    )
}

export default JudgementPanel