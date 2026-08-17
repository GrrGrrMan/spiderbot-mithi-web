// web-ui/src/tests/motionSynthesizer.test.js
// Chunk 2 — port-fidelity tests for the legacy MotionSynthesizer port
// (web-ui/src/hexapod/solvers/motionSynthesizer.js).
import {
    interpolatePoses,
    buildSequenceFromKeyframes,
    getIkPose,
    generatePresetFrames,
    expandGaitSequence,
} from "../hexapod/solvers/motionSynthesizer"
import { DEFAULT_POSE, DEFAULT_DIMENSIONS, DEFAULT_IK_PARAMS } from "../templates"

const LEGS = ["leftFront", "rightFront", "leftMiddle", "rightMiddle", "leftBack", "rightBack"]

const makePose = angle =>
    LEGS.reduce((pose, leg) => {
        pose[leg] = { alpha: angle, beta: angle, gamma: angle }
        return pose
    }, {})

describe("interpolatePoses", () => {
    test("returns steps+1 frames covering all 6 legs", () => {
        const frames = interpolatePoses(makePose(0), makePose(90), 10)
        expect(frames).toHaveLength(11)
        LEGS.forEach(leg => expect(frames[0][leg]).toBeDefined())
    })

    test("first frame equals start pose, last equals target", () => {
        const start = makePose(0)
        const target = makePose(90)
        const frames = interpolatePoses(start, target, 10)
        expect(frames[0]).toEqual(start)
        expect(frames[10]).toEqual(target)
    })

    test("midpoint is the arithmetic average (cosine ease at t=0.5)", () => {
        const frames = interpolatePoses(makePose(0), makePose(90), 10)
        expect(frames[5].leftFront.alpha).toBeCloseTo(45, 5)
    })

    test("missing legs are treated as zero pose", () => {
        const frames = interpolatePoses({}, { leftFront: { alpha: 30, beta: 30, gamma: 30 } }, 2)
        expect(frames[0].leftFront).toEqual({ alpha: 0, beta: 0, gamma: 0 })
    })
})

describe("buildSequenceFromKeyframes", () => {
    test("empty keyframes return [DEFAULT_POSE]", () => {
        expect(buildSequenceFromKeyframes([])).toEqual([DEFAULT_POSE])
    })

    test("single keyframe interpolates from DEFAULT_POSE", () => {
        const frames = buildSequenceFromKeyframes([makePose(60)], 5)
        expect(frames).toHaveLength(6)
        expect(frames[5]).toEqual(makePose(60))
    })

    test("multiple keyframes de-dupe join frames", () => {
        const frames = buildSequenceFromKeyframes([makePose(0), makePose(45), makePose(90)], 5)
        // 2 transitions x (5+1) frames - 1 duplicate join frame = 11
        expect(frames).toHaveLength(11)
        expect(frames[0]).toEqual(makePose(0))
        expect(frames[10]).toEqual(makePose(90))
    })
})

describe("getIkPose", () => {
    test("valid IK params produce a 6-leg pose", () => {
        const pose = getIkPose(DEFAULT_DIMENSIONS, DEFAULT_IK_PARAMS)
        LEGS.forEach(leg => expect(pose[leg]).toBeDefined())
    })

    test("unsolvable params fall back to DEFAULT_POSE", () => {
        expect(getIkPose(DEFAULT_DIMENSIONS, { tx: 5, ty: 5, tz: 5 })).toEqual(DEFAULT_POSE)
    })
})

describe("generatePresetFrames", () => {
    test("wave preset moves the right front leg and ends at DEFAULT_POSE", () => {
        const frames = generatePresetFrames("wave", DEFAULT_DIMENSIONS, 1)
        expect(frames.length).toBeGreaterThan(1)
        expect(frames[0]).toEqual(DEFAULT_POSE)
        expect(frames[frames.length - 1]).toEqual(DEFAULT_POSE)
        expect(frames.some(f => f.rightFront.alpha !== 0)).toBe(true)
    })

    test("cheer preset moves both front legs", () => {
        const frames = generatePresetFrames("cheer", DEFAULT_DIMENSIONS, 1)
        expect(frames.length).toBeGreaterThan(1)
        expect(frames[frames.length - 1]).toEqual(DEFAULT_POSE)
        expect(frames.some(f => f.leftFront.alpha !== 0 && f.rightFront.alpha !== 0)).toBe(true)
    })

    test("IK-based presets (lookAround, stretch) end at DEFAULT_POSE", () => {
        ;["lookAround", "stretch"].forEach(name => {
            const frames = generatePresetFrames(name, DEFAULT_DIMENSIONS, 1)
            expect(frames.length).toBeGreaterThan(1)
            expect(frames[frames.length - 1]).toEqual(DEFAULT_POSE)
        })
    })

    test("unknown preset falls back to a smooth reset", () => {
        const start = makePose(20)
        const frames = generatePresetFrames("doesNotExist", DEFAULT_DIMENSIONS, 1, start, 10)
        expect(frames).toHaveLength(11)
        expect(frames[0]).toEqual(start)
        expect(frames[10]).toEqual(DEFAULT_POSE)
    })
})

describe("expandGaitSequence", () => {
    const seq = {
        leftFront: { alpha: [0, 10], beta: [0, 10], gamma: [0, 10] },
        rightFront: { alpha: [0, -10], beta: [0, -10], gamma: [0, -10] },
    }

    test("empty input returns []", () => {
        expect(expandGaitSequence(null)).toEqual([])
        expect(expandGaitSequence({})).toEqual([])
    })

    test("expands raw walkSequence into interpolated frames", () => {
        const frames = expandGaitSequence(seq, 3, 1)
        // 2 raw poses -> 1 transition with 3 steps -> 4 frames
        expect(frames).toHaveLength(4)
        expect(frames[0].leftFront).toEqual({ alpha: 0, beta: 0, gamma: 0 })
        expect(frames[3].rightFront.alpha).toBeCloseTo(-10, 5)
    })
})