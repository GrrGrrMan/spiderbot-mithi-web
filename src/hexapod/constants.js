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

/*

   hexapodYaxis
       ^
       |
       |
       *-----> hexapodXaxis
      / (cog)
     /
  hexapodZaxis

  Relative x-axis, for each attached linkage

  (+135)  x2          x1 (+45)
           \   head  /
            *---*---*
           /    |    \
          /     |     \
 (+180)  /      |      \
   x3 --*------cog------*-- x0 (+0)
         \      |      /
          \     |     /
           \    |    /
            *---*---*
           /         \
         x4           x5
      (+225)        (+315)
 */
const DEFAULT_DIMENSIONS = {
    front: 50,    // Scaled to match 0.5 * R
    side: 86.6,   // Scaled to match 0.866 * R
    middle: 100,  // The outer radius R of the center chassis
    coxia: 52,    // Matches COXA_LENGTH_MM
    femur: 66,    // Matches FEMUR_LENGTH_MM
    tibia: 132,   // Matches TIBIA_LENGTH_MM
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
