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

// Hàm normalize vector
function normalize(v: Vec3): Vec3 {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (len === 0) return [0, 0, 0];
    return [v[0] / len, v[1] / len, v[2] / len];
}

// Hàm cross product
function cross(a: Vec3, b: Vec3): Vec3 {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

// Hàm xoay vector 'dir' quanh trục 'axis' góc 'angle' (radian)
function rotateVector(dir: Vec3, axis: Vec3, angle: number): Vec3 {
    const [x, y, z] = dir;
    const [ax, ay, az] = normalize(axis); // ✅ normalize axis
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const dot = x * ax + y * ay + z * az;

    return [
        ax * dot * (1 - cosA) + x * cosA + (-az * y + ay * z) * sinA,
        ay * dot * (1 - cosA) + y * cosA + (az * x - ax * z) * sinA,
        az * dot * (1 - cosA) + z * cosA + (-ay * x + ax * y) * sinA,
    ];
}

export function generateLSystemSegments(
    axiom: string,
    rules: Record<string, string>,
    iterations: number,
    angleDeg = 42,
    segmentLength = 3
): Segment[] {
    let result = axiom;
    for (let i = 0; i < iterations; i++) {
        result = result
            .split("")
            .map((c) => rules[c] ?? c)
            .join("");
    }

    const angle = degToRad(angleDeg);
    const segments: Segment[] = [];

    // ✅ Turtle state with proper orthogonal basis
    class TurtleState {
        position: Vec3;
        heading: Vec3;    // forward direction
        left: Vec3;       // left direction  
        up: Vec3;         // up direction
        parentId: number;
        depth: number;

        constructor(
            pos: Vec3 = [0, 0, 0],
            heading: Vec3 = [0, 1, 0],
            left: Vec3 = [-1, 0, 0],
            up: Vec3 = [0, 0, 1],
            parentId: number = -1,
            depth: number = 0
        ) {
            this.position = [...pos];
            this.heading = normalize(heading);
            this.left = normalize(left);
            this.up = normalize(up);
            this.parentId = parentId;
            this.depth = depth;
        }

        // ✅ Ensure orthogonal basis after rotation
        orthonormalize() {
            this.heading = normalize(this.heading);
            this.left = normalize(cross(this.up, this.heading));
            this.up = normalize(cross(this.heading, this.left));
        }

        copy(): TurtleState {
            return new TurtleState(
                [...this.position],
                [...this.heading],
                [...this.left],
                [...this.up],
                this.parentId,
                this.depth
            );
        }

        // Rotate around up axis (yaw) - turn left/right
        turnLeft(angle: number) {
            this.heading = rotateVector(this.heading, this.up, angle);
            this.left = rotateVector(this.left, this.up, angle);
            this.orthonormalize();
        }

        turnRight(angle: number) {
            this.turnLeft(-angle);
        }

        // Rotate around left axis (pitch) - pitch up/down
        pitchUp(angle: number) {
            this.heading = rotateVector(this.heading, this.left, angle);
            this.up = rotateVector(this.up, this.left, angle);
            this.orthonormalize();
        }

        pitchDown(angle: number) {
            this.pitchUp(-angle);
        }

        // Rotate around heading axis (roll) - roll left/right
        rollLeft(angle: number) {
            this.left = rotateVector(this.left, this.heading, angle);
            this.up = rotateVector(this.up, this.heading, angle);
            this.orthonormalize();
        }

        rollRight(angle: number) {
            this.rollLeft(-angle);
        }

        // Move forward
        moveForward(distance: number): Vec3 {
            const newPos: Vec3 = [
                this.position[0] + this.heading[0] * distance,
                this.position[1] + this.heading[1] * distance,
                this.position[2] + this.heading[2] * distance,
            ];
            return newPos;
        }
    }

    const stack: TurtleState[] = [];
    let turtle = new TurtleState();
    let segmentId = 0;

    for (const char of result) {
        switch (char) {
            case "F": {
                const nextPos = turtle.moveForward(segmentLength);
                segments.push({
                    A: [...turtle.position],
                    B: nextPos,
                    parentId: turtle.parentId,
                    depth: turtle.depth,
                    isBranchStart: false,
                });
                turtle.position = nextPos;
                turtle.parentId = segmentId++;
                break;
            }
            case "+": {
                turtle.turnLeft(angle);
                break;
            }
            case "-": {
                turtle.turnRight(angle);
                break;
            }
            case "&": {
                turtle.pitchDown(angle);
                break;
            }
            case "^": {
                turtle.pitchUp(angle);
                break;
            }
            case "\\": {
                turtle.rollLeft(angle);
                break;
            }
            case "/": {
                turtle.rollRight(angle);
                break;
            }
            case "|": {
                turtle.turnLeft(Math.PI); // 180 degree turn
                break;
            }
            case "[": {
                stack.push(turtle.copy());
                turtle.depth++;
                break;
            }
            case "]": {
                const state = stack.pop();
                if (state) {
                    turtle = state;
                    // Mark next segment as branch start
                    if (segments.length > 0) {
                        segments[segments.length - 1].isBranchStart = true;
                    }
                }
                break;
            }
        }
    }

    return segments;
}

export function packSegments(segments: Segment[]) {
    const points: number[] = [];
    const meta: number[] = [];
  
    for (const seg of segments) {

   //     console.log(`Segment: A[${seg.A[0].toFixed(2)}, ${seg.A[1].toFixed(2)}, ${seg.A[2].toFixed(2)}] -> B[${seg.B[0].toFixed(2)}, ${seg.B[1].toFixed(2)}, ${seg.B[2].toFixed(2)}]`);
        let oo = 0
        if(seg.depth === 0){
            oo = .1
        }else if(seg.depth === 1){
            oo = .2
        }else if(seg.depth === 2){
            oo = .2
        }else{
            oo = .3
        }
        points.push(...seg.A, ...seg.B);
        meta.push(
            seg.parentId ?? 9999,
           oo,
            seg.isBranchStart ? 1 : 0,
            0
        );
    }
 
    return {
        points: new Float32Array(points),
        meta: new Float32Array(meta),
    };
}