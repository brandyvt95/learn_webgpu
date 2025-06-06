type Vec3 = [number, number, number];

interface Segment {
  A: Vec3;
  B: Vec3;
  parentId: number;
  depth: number;
  isBranchStart: boolean;
}

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(...v);
  return len === 0 ? [0, 0, 0] : [v[0] / len, v[1] / len, v[2] / len];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function rotateVector(vec: Vec3, axis: Vec3, angleDeg: number): Vec3 {
  const angleRad = degToRad(angleDeg);
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const dot = vec[0] * axis[0] + vec[1] * axis[1] + vec[2] * axis[2];
  const crossProd = cross(axis, vec);
  return [
    vec[0] * cosA + crossProd[0] * sinA + axis[0] * dot * (1 - cosA),
    vec[1] * cosA + crossProd[1] * sinA + axis[1] * dot * (1 - cosA),
    vec[2] * cosA + crossProd[2] * sinA + axis[2] * dot * (1 - cosA),
  ];
}

interface TurtleState {
  pos: Vec3;
  heading: Vec3;
  left: Vec3;
  up: Vec3;
  parentId: number;
  depth: number;
}
function getStepSize(depth: number, segmentIndex: number): number {
  // Ví dụ: đoạn đầu nhánh dài hơn, dần ngắn lại
  const baseLength = 3 - depth ;
  const length = baseLength * Math.pow(0.8, segmentIndex);

  // Có thể random nhỏ
  return length * (0.85 + Math.random() * 0.3);
}

export function generateLSystemSegments(
  axiom: string,
  rules: Record<string, string>,
  iterations: number,
  angle: number,
  stepSize: number
): Segment[] {
  let result = axiom;
  for (let i = 0; i < iterations; i++) {
    let next = "";
    for (const char of result) {
      next += rules[char] ?? char;
    }
    result = next;
  }

  const segments: Segment[] = [];

  let turtle: TurtleState = {
    pos: [0, 0, 0],
    heading: [0, 1, 0], // hướng lên ban đầu
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
         const currentStepSize = getStepSize(turtle.depth,segmentIndex);
        const newPos: Vec3 = [
          turtle.pos[0] + turtle.heading[0] * currentStepSize,
          turtle.pos[1] + turtle.heading[1] * currentStepSize,
          turtle.pos[2] + turtle.heading[2] * currentStepSize,
        ];
        segments.push({
          A: turtle.pos,
          B: newPos,
          parentId: turtle.parentId,
          depth: turtle.depth,
          isBranchStart: stack.length > 0 && segments.length > 0 && segments[segments.length - 1].depth !== turtle.depth,
        });
         segmentIndex++;
        turtle.parentId = segments.length - 1;
        turtle.pos = newPos;
        break;
      }
      case "+": // yaw +
        turtle.heading = normalize(rotateVector(turtle.heading, turtle.up, angle));
        turtle.left = normalize(cross(turtle.up, turtle.heading));
        break;
      case "-": // yaw -
        turtle.heading = normalize(rotateVector(turtle.heading, turtle.up, -angle));
        turtle.left = normalize(cross(turtle.up, turtle.heading));
        break;
      case "&": // pitch down
        turtle.heading = normalize(rotateVector(turtle.heading, turtle.left, angle));
        turtle.up = normalize(cross(turtle.heading, turtle.left));
        break;
      case "^": // pitch up
        turtle.heading = normalize(rotateVector(turtle.heading, turtle.left, -angle));
        turtle.up = normalize(cross(turtle.heading, turtle.left));
        break;
      case "\\": // roll left
        turtle.left = normalize(rotateVector(turtle.left, turtle.heading, angle));
        turtle.up = normalize(cross(turtle.heading, turtle.left));
        break;
      case "/": // roll right
        turtle.left = normalize(rotateVector(turtle.left, turtle.heading, -angle));
        turtle.up = normalize(cross(turtle.heading, turtle.left));
        break;
       case "[": {
      // Lưu trạng thái hiện tại trước khi vào nhánh mới
      stack.push({...turtle}); // copy state
      turtle.depth += 1;       // tăng depth khi vào nhánh
         segmentIndex = 0;
      break;
    }
    case "]": {
      // Lấy trạng thái nhánh trước ra
      const prevState = stack.pop();
      if (prevState) {
        turtle = prevState;   // khôi phục lại depth, pos, heading...
      }
         segmentIndex = 0; 
      break;
    }
    }
  }

  return segments;
}


export function packSegments(segments: Segment[]) {
    const points: number[] = [];
    const meta: number[] = [];
   //  segments.sort((a, b) => a.depth - b.depth);
    console.log("length seg" ,segments.length,segments)
    for (const seg of segments) {
        points.push(...seg.A, ...seg.B);
        meta.push(
            seg.parentId ?? 9999,
            seg.depth,
            seg.isBranchStart ? 1 : 0,
            Math.random()
        );
    }
 
    return {
        origin:segments,
        points: new Float32Array(points),
        meta: new Uint32Array(meta),
    };
}