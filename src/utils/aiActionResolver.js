// web-ui/src/utils/aiActionResolver.js
import { matchAction } from "./aiActionMatcher"

/**
 * Resolves an incoming AI message or directive into a canonical action object.
 * Strictly checks explicit directive properties (action_id, action, preset, joint_params)
 * to avoid false-positive triggers from conversational text or raw audio transcripts.
 */
export const resolveAction = (msg, actionsList = []) => {
    if (!msg) return null

    // 1. Single-Joint Stand Articulation
    if (msg.action_id === "single_joint" || msg.action === "single_joint" || msg.joint_params) {
        return { id: "single_joint", joint_params: msg.joint_params }
    }

    const actionId = msg.action_id || msg.action || (msg.type === "directive" ? msg.preset : null)
    if (!actionId) return null

    const rawStr = String(actionId).trim()

    // 2. Direct ID Match
    let found = actionsList.find(x => x.id.toLowerCase() === rawStr.toLowerCase())
    if (found) return found

    // 3. Preset Name Match (e.g. payload.preset === "lookAround")
    found = actionsList.find(x => x.payload?.preset && x.payload.preset.toLowerCase() === rawStr.toLowerCase())
    if (found) return found

    // 4. Action Card Display Name Match
    found = actionsList.find(x => x.name.toLowerCase() === rawStr.toLowerCase())
    if (found) return found

    // 5. Normalized Match (handling snake_case / camelCase / hyphens)
    const normalized = rawStr.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").toLowerCase()
    found = actionsList.find(x => {
        if (x.id.replace(/[_-]/g, " ").toLowerCase() === normalized) return true
        if (x.name.toLowerCase() === normalized) return true
        if (Array.isArray(x.keywords) && x.keywords.some(kw => kw.toLowerCase() === normalized || normalized.includes(kw.toLowerCase()))) {
            return true
        }
        return false
    })
    if (found) return found

    // 6. Generic Action Matcher fallback on the action ID string
    return matchAction(rawStr, actionsList)
}