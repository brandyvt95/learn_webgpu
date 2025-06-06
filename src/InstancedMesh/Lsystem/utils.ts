import { flowerType } from "./flower";
import { getStepSize, interp } from "./helper";
import { cross, normalize, rotateVector } from "./math";
import { LSystemConfig, Segment, TurtleState, Vec3 } from "./type";


export function generateLSystemSegments(config: LSystemConfig): Segment[] {
  let result = config.axiom;
  for (let i = 0; i < config.iterations; i++) {
    let next = "";
    for (const char of result) {
      next += config.rules[char] ?? char;
    }
    result = next;
  }

  const segments: Segment[] = [];
  let turtle: TurtleState = {
    pos: [0, 0, 0],
    heading: [0, 1, 0],
    left: [-1, 0, 0],
    up: [0, 0, 1],
    parentId: -1,
    depth: 0,
  };

  let segmentIndex = 0;
  const stack: TurtleState[] = [];

  for (const char of result) {
    switch (char) {
      case "F": {
        const currentStepSize = getStepSize(config, turtle.depth, segmentIndex);
        const newPos: Vec3 = [
          turtle.pos[0] + turtle.heading[0] * currentStepSize,
          turtle.pos[1] + turtle.heading[1] * currentStepSize,
          turtle.pos[2] + turtle.heading[2] * currentStepSize,
        ];

        const newSegment: Segment = {
          A: turtle.pos,
          B: newPos,
          parentId: turtle.parentId,
          depth: turtle.depth,
          isBranchStart: stack.length > 0 && segments.length > 0 && segments[segments.length - 1].depth !== turtle.depth,
          type: 'branch'
        };

        segments.push(newSegment);
        segmentIndex++;
        turtle.parentId = segments.length - 1;
        turtle.pos = newPos;
        break;
      }

      case "G": {
        const currentStepSize = getStepSize(config, turtle.depth, segmentIndex);
        const newPos: Vec3 = [
          turtle.pos[0] + turtle.heading[0] * currentStepSize,
          turtle.pos[1] + turtle.heading[1] * currentStepSize,
          turtle.pos[2] + turtle.heading[2] * currentStepSize,
        ];

        const newSegment: Segment = {
          A: turtle.pos,
          B: newPos,
          parentId: turtle.parentId,
          depth: turtle.depth,
          isBranchStart: stack.length > 0 && segments.length > 0 && segments[segments.length - 1].depth !== turtle.depth,
          type: 'branch'
        };

        segments.push(newSegment);
        segmentIndex++;
        turtle.parentId = segments.length - 1;
        turtle.pos = newPos;
        break;
      }

      case "L": {
        const leafSize = config.stepSize * 0.3;
        const leafCount = 4;
        const currentParentId = turtle.parentId;

        for (let i = 0; i < leafCount; i++) {
          const angle = (360 / leafCount) * i + Math.random() * 30 - 15;
          const leafDirection = rotateVector(turtle.left, turtle.heading, angle);
          const leafUpOffset = [
            turtle.up[0] * leafSize * 0.3,
            turtle.up[1] * leafSize * 0.3,
            turtle.up[2] * leafSize * 0.3,
          ];

          const leafPos: Vec3 = [
            turtle.pos[0] + leafDirection[0] * leafSize + leafUpOffset[0],
            turtle.pos[1] + leafDirection[1] * leafSize + leafUpOffset[1],
            turtle.pos[2] + leafDirection[2] * leafSize + leafUpOffset[2],
          ];

          const leafSegment: Segment = {
            A: turtle.pos,
            B: leafPos,
            parentId: currentParentId,
            depth: turtle.depth,
            isBranchStart: false,
            type: 'leaf'
          };

          segments.push(leafSegment);
        }
        break;
      }

      case "H": {

        const petalCount = 6;
        const currentParentId = turtle.parentId;
        const lastSegment = segments[segments.length - 1];

        const rand = Math.random()
        let rand2 = .2

        for (let i = 0; i < petalCount; i++) {
          if (rand > .5) rand2 = Math.random()
          const flowerSize = config.stepSize * rand2;
          const posPetal = flowerType({
            posStart:turtle.pos,
            type: 1,
            turtle: turtle,
            petalCount: petalCount,
            i: i,
            flowerSize: .2,
            segmentParent: lastSegment,
          });
          const flowerSegment: Segment = {
            A: posPetal.posA,
            B: posPetal.posB,
            parentId: currentParentId,
            depth: turtle.depth,
            isBranchStart: false,
            type: 'flower'
          };

          segments.push(flowerSegment);
        }
        break;
      }

      case "+":
        turtle.heading = normalize(rotateVector(turtle.heading, turtle.up, config.angle));
        turtle.left = normalize(cross(turtle.up, turtle.heading));
        break;

      case "-":
        turtle.heading = normalize(rotateVector(turtle.heading, turtle.up, -config.angle));
        turtle.left = normalize(cross(turtle.up, turtle.heading));
        break;

      case "&":
        turtle.heading = normalize(rotateVector(turtle.heading, turtle.left, config.angle));
        turtle.up = normalize(cross(turtle.heading, turtle.left));
        break;

      case "^":
        turtle.heading = normalize(rotateVector(turtle.heading, turtle.left, -config.angle));
        turtle.up = normalize(cross(turtle.heading, turtle.left));
        break;

      case "\\":
        turtle.left = normalize(rotateVector(turtle.left, turtle.heading, config.angle));
        turtle.up = normalize(cross(turtle.heading, turtle.left));
        break;

      case "/":
        turtle.left = normalize(rotateVector(turtle.left, turtle.heading, -config.angle));
        turtle.up = normalize(cross(turtle.heading, turtle.left));
        break;

      case "[": {
        stack.push({ ...turtle });
        turtle.depth += 1;
        segmentIndex = 0;
        break;
      }

      case "]": {
        const prevState = stack.pop();
        if (prevState) {
          turtle = prevState;
        }
        segmentIndex = 0;
        break;
      }
    }
  }

  return segments;
}

