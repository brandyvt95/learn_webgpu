export type Vec3 = [number, number, number];

export interface Segment {
  A: Vec3;
  B: Vec3;
  parentId: number;
  depth: number;
  isBranchStart: boolean;
  type: 'branch' | 'flower' | 'leaf';
}

export interface LSystemConfig {
  axiom: string;
  rules: Record<string, string>;
  iterations: number;
  angle: number;
  stepSize: number;
  branchReduction?: number;
  randomFactor?: number;
}


export interface TurtleState {
  pos: Vec3;
  heading: Vec3;
  left: Vec3;
  up: Vec3;
  parentId: number;
  depth: number;
}