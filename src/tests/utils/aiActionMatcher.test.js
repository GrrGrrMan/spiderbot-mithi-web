import ACTIONS from "../../constants/aiActions.json"
import { matchAction } from "../../utils/aiActionMatcher"

const actions = ACTIONS.actions

describe("aiActionMatcher (offline fallback)", () => {
    test("matches walk_forward on 'please walk forward'", () => {
        const hit = matchAction("please walk forward", actions)
        expect(hit.id).toBe("walk_forward")
    })

    test("matches 'do a spin' to spin", () => {
        expect(matchAction("Can you do a spin?", actions).id).toBe("spin")
    })

    test("is case- and whitespace-insensitive", () => {
        expect(matchAction("  WALK   FORWARD ", actions).id).toBe("walk_forward")
    })

    test("returns null for a chat-only utterance", () => {
        expect(matchAction("what is your name", actions)).toBeNull()
    })

    test("returns null for empty input", () => {
        expect(matchAction("", actions)).toBeNull()
        expect(matchAction(null, actions)).toBeNull()
    })

    test("audio actions resolve", () => {
        expect(matchAction("make a beep", actions).id).toBe("beep")
        expect(matchAction("play the curious sound", actions).id).toBe("alarm_curious")
    })
})