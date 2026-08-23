// web-ui/src/utils/servoMapper.js



export const buildServoBatchPayload = pose => {
    // The ESP32 MotionController automatically applies inversions, trim offsets, and PWM conversion.
    return { 
        type: "pose", 
        pose: pose 
    }
}