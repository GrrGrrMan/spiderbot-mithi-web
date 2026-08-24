// web-ui/src/utils/aiActionResolver.js
import { matchAction } from "./aiActionMatcher"

/**
 * Resolves an incoming AI message or directive into a canonical action object.
 * Supports static presets, single joints, dynamic keyframe sequences, and parametric motions.
 */
export const resolveAction = (msg, actionsList = []) => {
    if (!msg) return null

    // 1. Single-Joint Articulation
    if (msg.action_id === "single_joint" || msg.action === "single_joint" || msg.joint_params) {
        return { id: "single_joint", joint_params: msg.joint_params }
    }

    // 2. Dynamic Keyframe Sequences (Supports direct payload objects or nested action_id)
    const seqCandidate = (typeof msg.action_id === "object" && msg.action_id !== null) ? msg.action_id : (msg.payload || msg)
    if (
        msg.type === "sequence" ||
        seqCandidate?.type === "sequence" ||
        (Array.isArray(seqCandidate?.keyframes) && seqCandidate.keyframes.length > 0)
    ) {
        const name = seqCandidate.name || (typeof msg.action_id === "string" ? msg.action_id : msg.name) || "sequence"
        return {
            id: (typeof msg.action_id === "string" ? msg.action_id : name),
            name: String(name).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
            payload: {
                type: "sequence",
                name: seqCandidate.name || name,
                duration_ms: seqCandidate.duration_ms || 2000,
                keyframes: seqCandidate.keyframes || [],
            },
            duration_ms: seqCandidate.duration_ms || 2000,
        }
    }

    // 3. Parametric Kinematic Motions & Postures
    if (msg.type === "motion" || msg.payload?.type === "motion") {
        const payload = msg.payload || msg
        const isLocomotion = (payload.vx && payload.vx !== 0) || (payload.vy && payload.vy !== 0) || (payload.omega && payload.omega !== 0)
        let actId = msg.action_id || (isLocomotion ? (payload.omega > 0 ? "turn_right" : payload.omega < 0 ? "turn_left" : payload.vx < 0 ? "walk_backward" : "walk_forward") : "pose")
        return {
            id: actId,
            name: (msg.name || actId).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
            payload: payload,
            duration_ms: payload.duration_ms || 2500,
        }
    }

    let actionId = msg.action_id || msg.action || (msg.type === "directive" ? (msg.preset || msg.name || msg.id) : null)
    if (!actionId) return null

    if (typeof actionId === "object" && actionId !== null) {
        actionId = actionId.name || actionId.id || actionId.preset || "action"
    }

    const rawStr = String(actionId).trim()

    const customDur = msg.duration_ms || (msg.payload && msg.payload.duration_ms)

    // 4. Direct ID Match
    let found = actionsList.find(x => x.id.toLowerCase() === rawStr.toLowerCase())
    if (found) return customDur ? { ...found, duration_ms: customDur } : found

    // 5. Preset Name Match
    found = actionsList.find(x => x.payload?.preset && x.payload.preset.toLowerCase() === rawStr.toLowerCase())
    if (found) return customDur ? { ...found, duration_ms: customDur } : found

    // 6. Action Card Display Name Match
    found = actionsList.find(x => x.name.toLowerCase() === rawStr.toLowerCase())
    if (found) return customDur ? { ...found, duration_ms: customDur } : found

    // 7. Normalized String Match
    const normalized = rawStr.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").toLowerCase()
    found = actionsList.find(x => {
        if (x.id.replace(/[_-]/g, " ").toLowerCase() === normalized) return true
        if (x.name.toLowerCase() === normalized) return true
        if (Array.isArray(x.keywords) && x.keywords.some(kw => kw.toLowerCase() === normalized || normalized.includes(kw.toLowerCase()))) {
            return true
        }
        return false
    })
    if (found) return customDur ? { ...found, duration_ms: customDur } : found

    const matched = matchAction(rawStr, actionsList)
    return (matched && customDur) ? { ...matched, duration_ms: customDur } : matched
}