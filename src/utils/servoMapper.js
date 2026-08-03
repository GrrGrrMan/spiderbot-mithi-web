// web-ui/src/utils/servoMapper.js

// Firmware PCA9685 Channel Maps (RF, RM, RR, LR, LM, LF)
const CHANNEL_MAPS = {
    rightFront:  { coxia: 25, femur: 26, tibia: 27, invert: false },
    rightMiddle: { coxia: 21, femur: 22, tibia: 23, invert: false },
    rightBack:   { coxia: 17, femur: 18, tibia: 19, invert: false },
    leftBack:    { coxia: 8,  femur: 9,  tibia: 10, invert: true  },
    leftMiddle:  { coxia: 4,  femur: 5,  tibia: 6,  invert: true  },
    leftFront:   { coxia: 0,  femur: 1,  tibia: 2,  invert: true  },
}

const US_PER_DEGREE = 11.11 // ~1000us span over 90 degrees

const angleToPulseUs = (angleDeg, invert) => {
    if (invert) angleDeg = -angleDeg
    let pulseUs = 1500 + angleDeg * US_PER_DEGREE
    return Math.min(2500, Math.max(500, Math.round(pulseUs)))
}

export const buildServoBatchPayload = pose => {
    const servos = []

    Object.keys(CHANNEL_MAPS).forEach(legName => {
        if (!pose[legName]) return

        const mapping = CHANNEL_MAPS[legName]
        const { alpha, beta, gamma } = pose[legName]

        // Transform Tibia angle: FW tibia = 90 - Web UI gamma
        const coxaAngle = Number(alpha)
        const femurAngle = Number(beta)
        const tibiaAngle = 90 - Number(gamma)

        servos.push({
            ch: mapping.coxia,
            pulse_us: angleToPulseUs(coxaAngle, mapping.invert),
        })
        servos.push({
            ch: mapping.femur,
            pulse_us: angleToPulseUs(femurAngle, mapping.invert),
        })
        servos.push({
            ch: mapping.tibia,
            pulse_us: angleToPulseUs(tibiaAngle, mapping.invert),
        })
    })

    return { type: "servo_batch", servos }
}