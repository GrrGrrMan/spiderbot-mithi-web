// web-ui/src/components/pages/AIPanel.js
// P5 — AI voice layer: chat + mic (STT) + action cards + AI service health.
// Drives: hexapod/{id}/ai (text + base64 WAV audio) via publishAi,
//         hexapod/cmd (motion/system actions) via publishImmediate,
//         hexapod/{id}/audio (speaker quick-actions) via publishAudio.
import React, { useState, useEffect, useRef, useCallback } from "react"
import AI_ACTIONS from "../../constants/aiActions.json"
import { SECTION_NAMES } from "../vars"
import { buildWav, to16kPcm, bytesToBase64, blockRms } from "../../utils/aiAudio"
import { matchAction } from "../../utils/aiActionMatcher"

const ACTIONS = AI_ACTIONS.actions
const SILENCE_RMS = 0.02          // below this RMS = silence
const SILENT_BLOCKS_FOR_END = 10  // ~0.85s @ 4096/48k blocks
const MAX_SLICE_MS = 2500         // flush long speech every 2.5s
const OFFLINE_REPLY = "I'm running in offline mode right now — try an action button!"
const MAX_PERSISTED_MESSAGES = 200  // ~sessionStorage body cap; trim older

// Session-scoped chat cache. Survives nav-away/nav-back, hard refresh, and
// tab restore. Per-device so multi-device users (?device=...) don't bleed.
// Cleared automatically on tab close (sessionStorage, not localStorage).
const chatStorageKey = (deviceId) => `hexapod/ai-chat/${deviceId || "default"}`

const loadChat = (deviceId) => {
    try {
        const raw = window.sessionStorage.getItem(chatStorageKey(deviceId))
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch (e) {
        return []
    }
}

const saveChat = (deviceId, messages) => {
    try {
        // Keep the last N (most relevant — LLM context window equivalent).
        const trim = messages.slice(-MAX_PERSISTED_MESSAGES)
        window.sessionStorage.setItem(chatStorageKey(deviceId), JSON.stringify(trim))
    } catch (e) {
        // sessionStorage full / disabled — silent; chat still works in-memory.
    }
}

const msgKey = m => `${m.role}|${m.type}|${m.content}`

const healthOf = aiStatus => {
    if (!aiStatus) return { label: "AI service: offline (deterministic mode)", color: "var(--c3-grey)" }
    switch (aiStatus.state) {
        case "online": return { label: "AI online", color: "var(--c1-green)" }
        case "busy": return { label: "AI busy…", color: "var(--c4-amber)" }
        case "error": return { label: "AI error", color: "var(--c6-red)" }
        default: return { label: "AI offline", color: "var(--c3-grey)" }
    }
}

const AIPanel = ({
    publishImmediate = () => {},
    publishAi = () => {},
    publishAudio = () => {},
    aiMessages = [],
    aiStatus = null,
    audioStatus = null,
    isConnected = false,
    onMount = () => {},
    aiDeviceId = "default",
}) => {
    const [messages, setMessages] = useState(() => loadChat(aiDeviceId))
    const [input, setInput] = useState("")
    const [recording, setRecording] = useState(false)
    const [micBlocked, setMicBlocked] = useState(false)

    const chatRef = useRef(null)
    const recordingRef = useRef({})

    const aiOnline = aiStatus && aiStatus.state === "online"
    const health = healthOf(aiStatus)

    useEffect(() => {
        onMount(SECTION_NAMES.ai)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Merge remote assistant replies (and our own round-tripped echoes).
    useEffect(() => {
        if (!aiMessages || !aiMessages.length) return
        setMessages(prev => {
            const seen = new Set(prev.map(msgKey))
            const added = aiMessages.filter(m => !seen.has(msgKey(m)))
            return added.length ? [...prev, ...added] : prev
        })
    }, [aiMessages])

    useEffect(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
    }, [messages])

    // Persist chat to sessionStorage on every change so nav-away/nav-back and
    // hard-refresh keep the visible history. Debounced-free: sessionStorage
    // writes are sync but cheap; capped at MAX_PERSISTED_MESSAGES by saveChat.
    useEffect(() => {
        saveChat(aiDeviceId, messages)
    }, [messages, aiDeviceId])

    const push = useCallback((role, content, type = "text") => {
        setMessages(prev => [...prev, { role, type, content, ts: Date.now() }])
    }, [])

    const clearChat = useCallback(() => {
        setMessages([])
        try { window.sessionStorage.removeItem(chatStorageKey(aiDeviceId)) } catch (e) { /* ignore */ }
    }, [aiDeviceId])

    const executeAction = useCallback(action => {
        const { payload, topic, duration_ms, reply } = action
        if (topic === "audio") {
            publishAudio(payload)
        } else {
            publishImmediate("hexapod/cmd", payload)
            if (duration_ms > 0) {
                // Match the RPi ai-service TTL: auto-stop after the duration hint.
                const stopPayload = { ...payload, vx: 0, vy: 0, omega: 0 }
                setTimeout(() => publishImmediate("hexapod/cmd", stopPayload), duration_ms)
            }
        }
        push("assistant", reply)
    }, [publishAudio, publishImmediate, push])

    const handleSend = useCallback(() => {
        const text = input.trim()
        if (!text) return
        push("user", text)
        setInput("")
        if (aiOnline) {
            // Full conversation memory (2026-08-17): ship the visible chat log
            // (excluding the message we just pushed) so the LLM sees prior turns.
            // ai-service caps to its MAX_LLM_HISTORY internally; we cap at 50
            // here to keep the MQTT payload reasonable.
            const history = messages
                .filter(m => m.role === "user" || m.role === "assistant")
                .slice(-50)
                .map(m => ({ role: m.role, content: m.content }))
            publishAi({ type: "text", role: "user", content: text, history })
            return
        }
        // Offline deterministic fallback (task 5.1): keyword -> action, else canned reply.
        const action = matchAction(text, ACTIONS)
        if (action) {
            executeAction(action)
        } else {
            push("assistant", OFFLINE_REPLY)
        }
    }, [input, aiOnline, publishAi, push, executeAction, messages])

    const finalizeSlice = useCallback(() => {
        const rec = recordingRef.current
        if (!rec.accum || rec.accum.length === 0) return
        const joined = new Float32Array(rec.accum.reduce((n, c) => n + c.length, 0))
        let off = 0
        for (const c of rec.accum) { joined.set(c, off); off += c.length }
        rec.accum = []
        rec.silentBlocks = 0

        const pcm = to16kPcm(joined, rec.sampleRate)
        const wav = buildWav(pcm, 16000)
        const b64 = bytesToBase64(wav)
        push("user", `🎤 voice slice (${Math.round(wav.length / 32)}ms audio)`)
        if (aiOnline) {
            // Same history contract as handleSend (full conversation memory).
            const history = messages
                .filter(m => m.role === "user" || m.role === "assistant")
                .slice(-50)
                .map(m => ({ role: m.role, content: m.content }))
            publishAi({ type: "audio", role: "user", content: b64, sample_rate_hz: 16000, history })
        } else {
            push("assistant", "I can't hear you in offline mode — try typing or an action button.")
        }
    }, [push, aiOnline, publishAi, messages])
    const startMic = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
            })
            const AudioCtx = window.AudioContext || window.webkitAudioContext
            const ctx = new AudioCtx()
            const source = ctx.createMediaStreamSource(stream)
            const processor = ctx.createScriptProcessor(4096, 1, 1)
            const gain = ctx.createGain()
            gain.gain.value = 0 // silent monitor (no speaker echo)
            source.connect(processor)
            processor.connect(gain)
            gain.connect(ctx.destination)

            const rec = recordingRef.current
            rec.ctx = ctx
            rec.stream = stream
            rec.accum = []
            rec.silentBlocks = 0
            rec.sampleRate = ctx.sampleRate || 48000
            rec.lastFlush = Date.now()

            processor.onaudioprocess = e => {
                const channel = e.inputBuffer.getChannelData(0)
                rec.accum.push(new Float32Array(channel))
                const rms = blockRms(channel)
                rec.silentBlocks = rms < SILENCE_RMS ? rec.silentBlocks + 1 : 0

                const now = Date.now()
                const hasAudio =
                    rec.accum.reduce((a, c) => a + c.length, 0) / rec.sampleRate
                const silenceEnded =
                    rec.silentBlocks >= SILENT_BLOCKS_FOR_END && hasAudio > 0.4
                const sliceExpired =
                    now - rec.lastFlush >= MAX_SLICE_MS && hasAudio >= 1.0
                if (silenceEnded || sliceExpired) {
                    rec.lastFlush = now
                    finalizeSlice()
                }
            }

            rec.processor = processor
            setRecording(true)
            setMicBlocked(false)
        } catch (err) {
            console.error("[AIPanel] Mic error:", err)
            setMicBlocked(true)
        }
    }, [finalizeSlice])

    const stopMic = useCallback(() => {
        const rec = recordingRef.current
        if (rec.processor) rec.processor.disconnect()
        if (rec.stream) rec.stream.getTracks().forEach(t => t.stop())
        if (rec.ctx) rec.ctx.close().catch(() => {})
        finalizeSlice()
        recordingRef.current = {}
        setRecording(false)
    }, [finalizeSlice])

    return (
        <div className="border" style={{ margin: "10px", padding: "10px" }}>
            <h2 style={{ marginTop: 0 }}>AI Assistant</h2>

            {/* Health row: AI service + speaker status */}
            <div style={{ display: "flex", gap: "14px", alignItems: "center", fontSize: "0.72rem", marginBottom: "8px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: health.color, display: "inline-block" }} />
                    {health.label}
                </span>
                <span>
                    STT local · TTS local · LLM {aiStatus && aiStatus.llm ? `${aiStatus.llm.provider}:${aiStatus.llm.model}` : "—"}
                </span>
                <span style={{ color: audioStatus && audioStatus.state === "playing" ? "var(--c4-amber)" : "inherit" }}>
                    {audioStatus && audioStatus.state === "playing" ? "🔊 speaking…" : "speaker idle"}
                </span>
                {!isConnected && <span style={{ color: "var(--c6-red)" }}>MQTT disconnected</span>}
                <span style={{ marginLeft: "auto" }}>
                    <button
                        type="button"
                        onClick={clearChat}
                        style={{ ...btnStyle, padding: "2px 6px", fontSize: "0.7rem" }}
                        title="Clear chat history (sessionStorage)"
                        disabled={messages.length === 0}
                    >
                        Clear
                    </button>
                </span>
            </div>
            {/* Chat log */}
            <div ref={chatRef} style={{ height: 200, overflowY: "auto", border: "1px solid var(--c3-grey)", borderRadius: 4, padding: "8px", marginBottom: "8px" }}>
                {messages.length === 0 && (
                    <div className="label" style={{ textAlign: "center", paddingTop: 70 }}>
                        Say something, or tap an action below.
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} style={{ textAlign: m.role === "user" ? "right" : "left", marginBottom: 6 }}>
                        <span
                            style={{
                                display: "inline-block",
                                maxWidth: "85%",
                                padding: "4px 8px",
                                borderRadius: 8,
                                background: m.role === "user" ? "var(--c4-amber)" : "var(--c2-purple)",
                                color: "#fff",
                                fontSize: "0.78rem",
                                wordBreak: "break-word",
                                whiteSpace: "pre-wrap",
                            }}
                        >
                            {m.content}
                        </span>
                    </div>
                ))}
            </div>

            {/* Input + mic */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSend()}
                    placeholder="Type a command or question…"
                    style={{ flex: 1, padding: "6px", borderRadius: 4, border: "1px solid var(--c3-grey)" }}
                    aria-label="AI input"
                />
                <button type="button" onClick={handleSend} style={btnStyle} disabled={!input.trim()}>
                    Send
                </button>
                <button
                    type="button"
                    onClick={recording ? stopMic : startMic}
                    style={btnStyle}
                    disabled={micBlocked}
                    title={micBlocked ? "Microphone unavailable" : recording ? "Stop recording" : "Record voice"}
                >
                    {recording ? "⏹ Stop" : "🎤 Talk"}
                </button>
            </div>
            {recording && (
                <div className="label" style={{ color: "var(--c6-red)", marginBottom: 6 }}>
                    ● Listening — speak now…
                </div>
            )}
            {micBlocked && (
                <div className="label" style={{ color: "var(--c6-red)", marginBottom: 6 }}>
                    Mic unavailable or permission denied.
                </div>
            )}

            {/* Action cards (canonical table): docs/future-roadmap/ai-voice/actions.json */}
            <div className="label" style={{ fontWeight: "bold", marginBottom: 4 }}>Actions</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {ACTIONS.map(a => (
                    <button
                        key={a.id}
                        type="button"
                        onClick={() => executeAction(a)}
                        style={btnStyle}
                        aria-label={a.name}
                        title={a.keywords.join(", ")}
                    >
                        {a.name}
                    </button>
                ))}
            </div>
        </div>
    )
}

const btnStyle = {
    padding: "5px 10px",
    borderRadius: 4,
    border: "1px solid var(--c3-grey)",
    background: "var(--c0-bg)",
    cursor: "pointer",
    fontSize: "0.75rem",
}

export default AIPanel