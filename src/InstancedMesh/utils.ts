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

// Hàm tạo cây từ L-system string
export function generateLSystemSegments(
    axiom: string,
    rules: Record<string, string>,
    iterations: number,
    angleDeg = 25,
    segmentLength = 1
): Segment[] {
    let result = axiom;
    for (let i = 0; i < iterations; i++) {
        result = result
            .split("")
            .map((c) => rules[c] ?? c)
            .join("");
    }

    const angle = degToRad(angleDeg);
    const positionStack: Vec3[] = [];
    const directionStack: Vec3[] = [];
    const idStack: number[] = [];
    const segments: Segment[] = [];

    let pos: Vec3 = [0, 0, 0];
    let dir: Vec3 = [0, 1, 0]; // hướng lên
    let currentId = -1;
    let parentId = -1;
    let depth = 0;

    for (const char of result) {
        switch (char) {
            case "F": {
                const newPos: Vec3 = [
                    pos[0] + dir[0] * segmentLength,
                    pos[1] + dir[1] * segmentLength,
                    pos[2] + dir[2] * segmentLength,
                ];

                segments.push({
                    A: [...pos],
                    B: [...newPos],
                    parentId,
                    depth,
                    isBranchStart: idStack.length > 0 && currentId !== idStack[idStack.length - 1],
                });

                currentId = segments.length - 1;
                parentId = currentId;
                pos = newPos;
                break;
            }
            case "+": {
                // xoay quanh trục Z
                const sin = Math.sin(angle);
                const cos = Math.cos(angle);
                dir = [dir[0] * cos - dir[1] * sin, dir[0] * sin + dir[1] * cos, dir[2]];
                break;
            }
            case "-": {
                const sin = Math.sin(-angle);
                const cos = Math.cos(-angle);
                dir = [dir[0] * cos - dir[1] * sin, dir[0] * sin + dir[1] * cos, dir[2]];
                break;
            }
            case "[": {
                positionStack.push([...pos]);
                directionStack.push([...dir]);
                idStack.push(parentId);
                depth++;
                break;
            }
            case "]": {
                pos = positionStack.pop()!;
                dir = directionStack.pop()!;
                parentId = idStack.pop()!;
                depth--;
                break;
            }
        }
    }

    return segments;
}

export function packSegments(segments) {
    const points: number[] = [];
    const meta: number[] = [];
    console.log(segments)
    for (const seg of segments) {
        
          
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
