import { cross, normalize } from "./math";
import { LSystemConfig, Segment, TurtleState, Vec3 } from "./type";
export const interp = (a: Vec3, b: Vec3, t: number): Vec3 => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
];


export function getPosOnSegment(t: number, segment: Segment): Vec3 {
    const dir = [
        segment.B[0] - segment.A[0],
        segment.B[1] - segment.A[1],
        segment.B[2] - segment.A[2],
    ];
    return [
        segment.A[0] + dir[0] * t,
        segment.A[1] + dir[1] * t,
        segment.A[2] + dir[2] * t,
    ];
}
export function getStepSize(config: LSystemConfig, depth: number, segmentIndex: number): number {
    const baseLength = config.stepSize * Math.pow(config.branchReduction || 0.8, depth);
    const length = baseLength * Math.pow(0.85, segmentIndex);
    const randomFactor = config.randomFactor || 0.3;
    return length * (0.85 + Math.random() * randomFactor);
}



export function computeTiltedDir({
    dir,   
    up,      
    i,   
    petalCount,
    tiltAmount
}: {
    dir: Vec3,      
    up: Vec3,       
    i: number,   
    petalCount: number,
    tiltAmount: number
}): Vec3 {
    const segmentDir = normalize(dir);

    let right = normalize(cross(segmentDir, up));
    let forward = normalize(cross(right, segmentDir));

    const angle = (Math.PI * 2 * i) / petalCount;

    let tiltedDir: Vec3 = [
        Math.cos(angle) * right[0] + Math.sin(angle) * forward[0],
        Math.cos(angle) * right[1] + Math.sin(angle) * forward[1],
        Math.cos(angle) * right[2] + Math.sin(angle) * forward[2],
    ];

    tiltedDir = normalize([
        tiltedDir[0] * (1 - tiltAmount) + up[0] * tiltAmount,
        tiltedDir[1] * (1 - tiltAmount) + up[1] * tiltAmount,
        tiltedDir[2] * (1 - tiltAmount) + up[2] * tiltAmount,
    ]);

    return tiltedDir;
}
