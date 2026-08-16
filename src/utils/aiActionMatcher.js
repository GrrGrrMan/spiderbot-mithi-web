// web-ui/src/utils/aiActionMatcher.js
// Deterministic stage-1 matcher for the P5 offline fallback: maps free text to an
// AI action from the canonical table. Pure function — unit-testable.
// NOTE: this mirrors the RPi ai-service stage-1 parser (pi-hub/services/ai-service).

/**
 * Find the best matching action for free text (case/whitespace-insensitive).
 * An action matches if ANY of its keywords is a substring of the normalized text.
 * @param {string} text - user utterance
 * @param {Array} actions - action table entries (from aiActions.json)
 * @returns {object|null} the matched action, or null
 */
export const matchAction = (text, actions) => {
    if (!text || !actions) return null
    const normalized = text.toLowerCase().trim().replace(/\s+/g, " ")
    for (const action of actions) {
        if (!action.keywords) continue
        const hit = action.keywords.some(k =>
            normalized.includes(k.toLowerCase().trim())
        )
        if (hit) return action
    }
    return null
}