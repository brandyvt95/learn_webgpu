import { Segment } from "./type";

export function packSegments(segments: Segment[]) {
  const points: number[] = [];
  const meta: number[] = [];
  //  segments.sort((a, b) => a.depth - b.depth);
  console.log("length seg", segments.length, segments)
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
    origin: segments,
    points: new Float32Array(points),
    meta: new Uint32Array(meta),
  };
}