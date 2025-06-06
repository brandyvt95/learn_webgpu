import { cross, normalize, rotateVector } from "./math";
import { Segment, TurtleState, Vec3 } from "./type";


type FlowerTypeName = 'default' | 'onSegment';

// Base chung
interface FlowerBase {
    type: FlowerTypeName;
    turtle: TurtleState;
    petalCount: number;
    flowerSize: number;
    i: number;
}

// Mỗi type có thể mở rộng base khác nhau
interface DefaultFlowerParams extends FlowerBase {
    type: 'default';
}

interface OnSegmentFlowerParams extends FlowerBase {
    type: 'onSegment';
    segment: Segment;
}

type FlowerTypeParams = DefaultFlowerParams | OnSegmentFlowerParams;

export const flowerType = (params: FlowerTypeParams): Vec3 => {
    if (params.type === 'default') {
        const angle = (360 / params.petalCount) * params.i;

        // Xoay quanh trục heading để lấy hướng tỏa ra
        const radialDir = rotateVector(params.turtle.left, params.turtle.heading, angle);

        // Sau đó, nghiêng nó xuống một chút để tạo chụm (hiệu ứng "rụng")
        const tiltAngle = 30; // điều chỉnh độ chụm
        const tiltAxis = cross(radialDir, params.turtle.heading); // Vuông góc để tạo trục nghiêng
        normalize(tiltAxis);

        const finalDir = rotateVector(radialDir, tiltAxis, tiltAngle);
        const petalPos: Vec3 = [
            params.turtle.pos[0] + finalDir[0] * params.flowerSize,
            params.turtle.pos[1] + finalDir[1] * params.flowerSize,
            params.turtle.pos[2] + finalDir[2] * params.flowerSize,
        ];
        return petalPos;
    }

    if (params.type === 'onSegment' && params.segment) {
     

        const t = (params.i + 0.5) / params.petalCount;

        const A = params.segment.A;
        const B = params.segment.B;

        const dir: Vec3 = [
            B[0] - A[0],
            B[1] - A[1],
            B[2] - A[2],
        ];

        // Vị trí trên đoạn AB
        const posOnSegment: Vec3 = [
            A[0] + dir[0] * t,
            A[1] + dir[1] * t,
            A[2] + dir[2] * t,
        ];
        console.log(posOnSegment)
        // Tính hướng nghiêng ra ngoài segment
        const segmentDir = normalize([...dir]);
        const up: Vec3 = [0, 1, 0]; // hoặc heading từ turtle
        let right = cross(segmentDir, up); // hướng vuông góc với đoạn
        right = normalize(right);

        // Nghiêng ra một góc (ví dụ 45°)
        const angle = Math.PI / 4; // 45°
        const tiltedDir = rotateVector(right, segmentDir, (Math.random() > 0.5 ? 1 : -1) * angle);

        // Cuối cùng: vị trí cánh hoa = điểm trên segment + hướng nghiêng
        const petalPos: Vec3 = [
            posOnSegment[0] + tiltedDir[0] * params.flowerSize,
            posOnSegment[1] + tiltedDir[1] * params.flowerSize,
            posOnSegment[2] + tiltedDir[2] * params.flowerSize,
        ];

        return petalPos;
    }

    // Trường hợp không đúng type hoặc không có segment cho onSegment
    return [0, 1, 0];
}
