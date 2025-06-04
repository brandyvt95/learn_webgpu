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

// Hàm xoay vector 'dir' quanh trục 'axis' góc 'angle' (radian)
function rotateVector(dir: Vec3, axis: Vec3, angle: number): Vec3 {
    const [x, y, z] = dir;
    const [ax, ay, az] = axis;
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
    angleDeg = 25,
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
    const position: Vec3 = [0, 0, 0];
    let direction: Vec3 = [0, 1, 0]; // ban đầu hướng lên trục Y
    let up: Vec3 = [0, 0, 1];
    let right: Vec3 = [1, 0, 0];

    type TurtleState = {
        position: Vec3;
        direction: Vec3;
        up: Vec3;
        right: Vec3;
        parentId: number;
        depth: number;
    };

    const stack: TurtleState[] = [];
    let currentParentId = -1;
    let segmentId = 0;
    let depth = 0;

    for (const char of result) {
        if (char === "F") {
            const nextPos: Vec3 = [
                position[0] + direction[0] * segmentLength,
                position[1] + direction[1] * segmentLength,
                position[2] + direction[2] * segmentLength,
            ];
            segments.push({
                A: [...position],
                B: nextPos,
                parentId: currentParentId,
                depth: depth,
                isBranchStart: false,
            });
            currentParentId = segmentId++;
            position[0] = nextPos[0];
            position[1] = nextPos[1];
            position[2] = nextPos[2];
        } else if (char === "+") {
            direction = rotateVector(direction, up, angle);
            right = rotateVector(right, up, angle);
        } else if (char === "-") {
            direction = rotateVector(direction, up, -angle);
            right = rotateVector(right, up, -angle);
        } else if (char === "&") {
            direction = rotateVector(direction, right, angle);
            up = rotateVector(up, right, angle);
        } else if (char === "^") {
            direction = rotateVector(direction, right, -angle);
            up = rotateVector(up, right, -angle);
        } else if (char === "/") {
            up = rotateVector(up, direction, angle);
            right = rotateVector(right, direction, angle);
        } else if (char === "\\") {
            up = rotateVector(up, direction, -angle);
            right = rotateVector(right, direction, -angle);
        } else if (char === "[") {
            stack.push({
                position: [...position],
                direction: [...direction],
                up: [...up],
                right: [...right],
                parentId: currentParentId,
                depth: depth,
            });
            depth++;
        } else if (char === "]") {
            const state = stack.pop();
            if (state) {
                position[0] = state.position[0];
                position[1] = state.position[1];
                position[2] = state.position[2];
                direction = [...state.direction];
                up = [...state.up];
                right = [...state.right];
                currentParentId = state.parentId;
                depth = state.depth;
                // Đánh dấu là nhánh mới bắt đầu
                if (segments.length > 0) {
                    segments[segments.length - 1].isBranchStart = true;
                }
            }
        }
    }

    return segments;
}

export function packSegments(segments) {
    const points: number[] = [];
    const meta: number[] = [];
  
    for (const seg of segments) {
        
        console.log(seg.A[2],seg.B[2])
        points.push(...seg.A, ...seg.B); // vec3[] to x,y,z,...
        meta.push(
            seg.parentId ?? -1,
            seg.depth ?? 0,
            seg.isBranchStart ? 1 : 0, // ✅ đúng key
            0
        );

    }
 
    return {
        points: new Float32Array(points),
        meta: new Float32Array(meta),
    };
}
