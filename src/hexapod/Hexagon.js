/* * *
  ..................
   Hexagon
  ..................

         |-f-|
         *---*---*--------   * f - front
        /    |    \     |    * s - side
       /     |     \    s    * m - middle
      /      |      \   |
     *------cog------* ---
      \      |      /|
       \     |     / |
        \    |    /  |
         *---*---*   |
             |       |
             |---m---|


      (leftFront)     (rightFront)
           v2          v1
            \   head  /
             *---*---*
            /    |    \
  (left    /     |     \
  Middle) /      |      \
    v3 --*------cog------*-- v0 (rightMiddle)
          \      |      /
           \     |     /
            \    |    /
             *---*---*
            /         \
          v4           v5
       (leftBack)   (rightBack)

 * * */
import { POSITION_NAMES_LIST } from "./constants"
import Vector from "./Vector"
import { transformMethods } from "./geometry"

class Hexagon {
    dimensions
    verticesList
    head
    cog
    constructor(dimensions, flags = { hasNoPoints: false }) {
        this.dimensions = dimensions

        if (flags.hasNoPoints) {
            return
        }

        const { front, middle, side } = this.dimensions
        const vertexX = [middle, front, -front, -middle, -front, front]
        const vertexY = [0, side, side, 0, -side, -side]

        this.verticesList = POSITION_NAMES_LIST.map(
            (position, i) => new Vector(vertexX[i], vertexY[i], 0, `${position}Vertex`, i)
        )
        this.head = new Vector(0, side, 0, "headPoint", 7)
        this.cog = new Vector(0, 0, 0, "centerOfGravityPoint", 6)
    }

    get closedPointsList() {
        return [...this.verticesList, this.verticesList[0]]
    }

    get allPointsList() {
        return [...this.verticesList, this.cog, this.head]
    }

    _doTransform(transformFunction, ...args) {
        let clone = new Hexagon(this.dimensions, { hasNoPoints: true })
        clone.cog = this.cog[transformFunction](...args)
        clone.head = this.head[transformFunction](...args)
        clone.verticesList = this.verticesList.map(point =>
            point[transformFunction](...args)
        )
        return clone
    }
}

Object.assign(Hexagon.prototype, transformMethods)

export default Hexagon
