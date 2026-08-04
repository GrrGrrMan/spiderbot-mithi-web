// web-ui/src/utils/servoMapper.js

// Firmware PCA9685 Channel Maps (RF, RM, RR, LR, LM, LF)
/*
const CHANNEL_MAPS = {
    rightFront:  { coxia: 25, femur: 26, tibia: 27, invert: false },
    rightMiddle: { coxia: 21, femur: 22, tibia: 23, invert: false },
    rightBack:   { coxia: 17, femur: 18, tibia: 19, invert: false },
    leftBack:    { coxia: 8,  femur: 9,  tibia: 10, invert: true  },
    leftMiddle:  { coxia: 4,  femur: 5,  tibia: 6,  invert: true  },
    leftFront:   { coxia: 0,  femur: 1,  tibia: 2,  invert: true  },
}
*/

/*
const US_PER_DEGREE = 11.11 // ~1000us span over 90 degrees

const angleToPulseUs = (angleDeg, invert) => {
    if (invert) angleDeg = -angleDeg
    let pulseUs = 1500 + angleDeg * US_PER_DEGREE
    return Math.min(2500, Math.max(500, Math.round(pulseUs)))
}
*/

export const buildServoBatchPayload = pose => {
    // The ESP32 MotionController automatically applies inversions, trim offsets, and PWM conversion.
    return { 
        type: "pose", 
        pose: pose 
    }
}