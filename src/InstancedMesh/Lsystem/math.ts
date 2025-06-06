import {Vec3 } from "./type";
export function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}
// Cộng vector
export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

// Trừ vector
export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

// Nhân vector với scalar
export function mulScalar(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}


export function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(...v);
  return len === 0 ? [0, 0, 0] : [v[0] / len, v[1] / len, v[2] / len];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
export function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}
export function rotateVector(vec: Vec3, axis: Vec3, angleDeg: number): Vec3 {
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
