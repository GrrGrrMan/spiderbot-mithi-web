// web-ui/src/hexapod/constants.js

const LEG_POINT_TYPES_LIST = [
    "bodyContactPoint",
    "coxiaPoint",
    "femurPoint",
    "footTipPoint",
]

const POSITION_NAME_TO_ID_MAP = {
    rightMiddle: 0,
    rightFront: 1,
    leftFront: 2,
    leftMiddle: 3,
    leftBack: 4,
    rightBack: 5,
}

const POSITION_NAMES_LIST = [
    "rightMiddle",
    "rightFront",
    "leftFront",
    "leftMiddle",
    "leftBack",
    "rightBack",
]

const ANGLE_NAMES_LIST = ["alpha", "beta", "gamma"]

const MAX_ANGLES = {
    alpha: 90,
    beta: 180,
    gamma: 180,
}

// Configured for regular 60-degree hexagonal corner mounting splay angles
const POSITION_NAME_TO_AXIS_ANGLE_MAP = {
    rightMiddle: 0,
    rightFront: 60,
    leftFront: 120,
    leftMiddle: 180,
    leftBack: 240,
    rightBack: 300,
}

const POSITION_NAME_TO_IS_LEFT_MAP = {
    rightMiddle: false,
    rightFront: false,
    leftFront: true,
    leftMiddle: true,
    leftBack: true,
    rightBack: false,
}

const NUMBER_OF_LEGS = 6

export {
    ANGLE_NAMES_LIST,
    LEG_POINT_TYPES_LIST,
    POSITION_NAME_TO_ID_MAP,
    POSITION_NAME_TO_AXIS_ANGLE_MAP,
    POSITION_NAMES_LIST,
    NUMBER_OF_LEGS,
    POSITION_NAME_TO_IS_LEFT_MAP,
    MAX_ANGLES,
}