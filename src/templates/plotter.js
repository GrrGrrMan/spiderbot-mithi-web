import { DATA, SCENE, LAYOUT, CAMERA_VIEW, DATA_INDEX_MAP } from "./"

const _getSumOfDimensions = dimensions =>
    Object.values(dimensions).reduce((sum, dimension) => sum + dimension, 0)

// Fast-path: Extracts arrays for traces 0..14 (Target Hexapod) for Plotly.restyle
export const getTargetTraceUpdates = (hexapod) => {
    const polygonVertices = hexapod.body.closedPointsList
    const bodyX = polygonVertices.map(point => point.x)
    const bodyY = polygonVertices.map(point => point.y)
    const bodyZ = polygonVertices.map(point => point.z)
    const { head, cog } = hexapod.body
    const { cogProjection, legs, groundContactPoints } = hexapod

    const axisScale = hexapod.body.dimensions.front / 2
    const { xAxis, yAxis, zAxis } = hexapod.localAxes

    const x = [
        bodyX,                                // 0: bodyMesh
        bodyX,                                // 1: bodyOutline
        [head.x],                             // 2: head
        [cog.x],                              // 3: centerOfGravity
        [cogProjection.x],                    // 4: centerOfGravityProjection
        legs[0].allPointsList.map(p => p.x),  // 5: rightMiddleLeg
        legs[1].allPointsList.map(p => p.x),  // 6: rightFrontLeg
        legs[2].allPointsList.map(p => p.x),  // 7: leftFrontLeg
        legs[3].allPointsList.map(p => p.x),  // 8: leftMiddleLeg
        legs[4].allPointsList.map(p => p.x),  // 9: leftBackLeg
        legs[5].allPointsList.map(p => p.x),  // 10: rightBackLeg
        groundContactPoints.map(p => p.x),    // 11: supportPolygonMesh
        [cog.x, cog.x + axisScale * xAxis.x], // 12: hexapodXaxis
        [cog.x, cog.x + axisScale * yAxis.x], // 13: hexapodYaxis
        [cog.x, cog.x + axisScale * zAxis.x], // 14: hexapodZaxis
    ]

    const y = [
        bodyY,
        bodyY,
        [head.y],
        [cog.y],
        [cogProjection.y],
        legs[0].allPointsList.map(p => p.y),
        legs[1].allPointsList.map(p => p.y),
        legs[2].allPointsList.map(p => p.y),
        legs[3].allPointsList.map(p => p.y),
        legs[4].allPointsList.map(p => p.y),
        legs[5].allPointsList.map(p => p.y),
        groundContactPoints.map(p => p.y),
        [cog.y, cog.y + axisScale * xAxis.y],
        [cog.y, cog.y + axisScale * yAxis.y],
        [cog.y, cog.y + axisScale * zAxis.y],
    ]

    const z = [
        bodyZ,
        bodyZ,
        [head.z],
        [cog.z],
        [cogProjection.z],
        legs[0].allPointsList.map(p => p.z),
        legs[1].allPointsList.map(p => p.z),
        legs[2].allPointsList.map(p => p.z),
        legs[3].allPointsList.map(p => p.z),
        legs[4].allPointsList.map(p => p.z),
        legs[5].allPointsList.map(p => p.z),
        groundContactPoints.map(p => p.z),
        [cog.z, cog.z + axisScale * xAxis.z],
        [cog.z, cog.z + axisScale * yAxis.z],
        [cog.z, cog.z + axisScale * zAxis.z],
    ]

    const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
    return { update: { x, y, z }, indices }
}

const _drawHexapod = (hexapod) => {

    // 1. SOLID HEXAPOD (Target)
    const polygonVertices = hexapod.body.closedPointsList
    const bodyX = polygonVertices.map(point => point.x)
    const bodyY = polygonVertices.map(point => point.y)
    const bodyZ = polygonVertices.map(point => point.z)
    const { head, cog } = hexapod.body
    const { cogProjection, legs, groundContactPoints } = hexapod

    const dBodyMesh = { ...DATA[DATA_INDEX_MAP.bodyMesh], x: bodyX, y: bodyY, z: bodyZ }
    const dBodyOutline = { ...DATA[DATA_INDEX_MAP.bodyOutline], x: bodyX, y: bodyY, z: bodyZ }
    const dHead = { ...DATA[DATA_INDEX_MAP.head], x: [head.x], y: [head.y], z: [head.z] }
    const dCog = { ...DATA[DATA_INDEX_MAP.centerOfGravity], x: [cog.x], y: [cog.y], z: [cog.z] }
    const dCogProjection = { ...DATA[DATA_INDEX_MAP.centerOfGravityProjection], x: [cogProjection.x], y: [cogProjection.y], z: [cogProjection.z] }

    const dLegs = legs.map(leg => ({
        ...DATA[DATA_INDEX_MAP[leg.name]],
        x: leg.allPointsList.map(point => point.x),
        y: leg.allPointsList.map(point => point.y),
        z: leg.allPointsList.map(point => point.z),
    }))

    const dSupportPolygon = {
        ...DATA[DATA_INDEX_MAP.supportPolygonMesh],
        x: groundContactPoints.map(point => point.x),
        y: groundContactPoints.map(point => point.y),
        z: groundContactPoints.map(point => point.z),
    }

    const axisScale = hexapod.body.dimensions.front / 2
    const { xAxis, yAxis, zAxis } = hexapod.localAxes
    const hXaxis = { ...DATA[DATA_INDEX_MAP.hexapodXaxis], x: [cog.x, cog.x + axisScale * xAxis.x], y: [cog.y, cog.y + axisScale * xAxis.y], z: [cog.z, cog.z + axisScale * xAxis.z] }
    const hYaxis = { ...DATA[DATA_INDEX_MAP.hexapodYaxis], x: [cog.x, cog.x + axisScale * yAxis.x], y: [cog.y, cog.y + axisScale * yAxis.y], z: [cog.z, cog.z + axisScale * yAxis.z] }
    const hZaxis = { ...DATA[DATA_INDEX_MAP.hexapodZaxis], x: [cog.x, cog.x + axisScale * zAxis.x], y: [cog.y, cog.y + axisScale * zAxis.y], z: [cog.z, cog.z + axisScale * zAxis.z] }
    const wXaxis = { ...DATA[DATA_INDEX_MAP.worldXaxis], x: [0, axisScale] }
    const wYaxis = { ...DATA[DATA_INDEX_MAP.worldYaxis], y: [0, axisScale] }
    const wZaxis = { ...DATA[DATA_INDEX_MAP.worldZaxis], z: [0, axisScale] }

    return [
        dBodyMesh, dBodyOutline, dHead, dCog, dCogProjection,
        ...dLegs, dSupportPolygon,
        hXaxis, hYaxis, hZaxis, wXaxis, wYaxis, wZaxis
    ]
}

const getNewPlotParams = (hexapod, cameraView) => {
    const data = _drawHexapod(hexapod)
    if ([null, undefined, {}].includes(cameraView)) cameraView = CAMERA_VIEW
    
    const range = _getSumOfDimensions(hexapod.dimensions)
    const newRange = [-range, range]
    const xaxis = { ...SCENE.xaxis, range: newRange }
    const yaxis = { ...SCENE.yaxis, range: newRange }
    const zaxis = { ...SCENE.zaxis, range: [-10, 2 * range - 10] }
    
    const scene = { ...SCENE, xaxis, yaxis, zaxis, camera: cameraView }
    const layout = { ...LAYOUT, scene }

    return [data, layout]
}

export default getNewPlotParams