import { computeTiltedDir, interp } from "./helper";
import { add, cross, lerp, mulScalar, normalize, rotateVector } from "./math";
import { Segment, TurtleState, Vec3 } from "./type";


type FlowerTypeName = 0 | 1;

// Base chung
interface FlowerBase {
    type: FlowerTypeName;
    turtle: TurtleState;
    petalCount: number;
    flowerSize: number;
    i: number;
    segmentParent?: Segment;
    posStart?: Vec3
}


export const flowerType = (params: FlowerBase): any => {
    if (params.type === 0) {
        const angle = (360 / params.petalCount) * params.i;

        // Xoay quanh trục heading để lấy hướng tỏa ra
        const radialDir = rotateVector(params.turtle.left, params.turtle.heading, angle);

        // Sau đó, nghiêng nó xuống một chút để tạo chụm (hiệu ứng "rụng")
        const tiltAngle = 30; // điều chỉnh độ chụm
        const tiltAxis = cross(radialDir, params.turtle.heading); // Vuông góc để tạo trục nghiêng
        normalize(tiltAxis);

        const finalDir = rotateVector(radialDir, tiltAxis, tiltAngle);
        const posB: Vec3 = [
            params.turtle.pos[0] + finalDir[0] * params.flowerSize,
            params.turtle.pos[1] + finalDir[1] * params.flowerSize,
            params.turtle.pos[2] + finalDir[2] * params.flowerSize,
        ];
        const posA = params.posStart
        return {
            posA: posA,
            posB: posB
        }
    }

    if (params.type === 1 && params.segmentParent) {

            const baseT = params.i / params.petalCount;
            const t = 0.5 + baseT * 0.5; 
            const A = params.segmentParent.A;
            const B = params.segmentParent.B;
            const posOnSegment = lerp(A, B, t);

            const tiltedDir = computeTiltedDir({
            dir: [B[0] - A[0], B[1] - A[1], B[2] - A[2]],
            up: [0, 1, 0],
            i: params.i,
            petalCount: params.petalCount,
            tiltAmount: 0.5
            });

            const posB = add(posOnSegment, mulScalar(tiltedDir, params.flowerSize));


        return {
            posA: posOnSegment,
            posB: posB
        }
    }

    // Trường hợp không đúng type hoặc không có segmentParent cho onSegment
    return [0, 1, 0];
}
