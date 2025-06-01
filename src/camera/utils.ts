import { mat4 } from 'wgpu-matrix';

export function updateProjection(
  canvas: any,
  projectionMatrix: Float32Array,
  fov: number,
  zNear: number,
  zFar: number
): void {
  const aspect = canvas.width / canvas.height;
  // Using mat4.perspective - wgpu-matrix handles WebGPU's Z range [0, 1] automatically
  mat4.perspective(fov, aspect, zNear, zFar, projectionMatrix);
}


/**
 * Create model matrix from position, rotation, and scale
 */
export function createModelMatrix(
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0], // radians: [x, y, z]
  scale: [number, number, number] = [1, 1, 1],
  modelMatrix?: Float32Array
): Float32Array {
  const matrix = modelMatrix || mat4.create();
  
  mat4.identity(matrix);
  
  // Apply transformations: Scale -> Rotate -> Translate
  mat4.translate(matrix, position, matrix);
  mat4.rotateX(matrix, rotation[0], matrix);
  mat4.rotateY(matrix, rotation[1], matrix);
  mat4.rotateZ(matrix, rotation[2], matrix);
  mat4.scale(matrix, scale, matrix);
  
  return matrix;
}

/**
 * Update existing model matrix
 */
export function updateModelMatrix(
  modelMatrix: Float32Array,
  position: [number, number, number],
  rotation: [number, number, number],
  scale: [number, number, number]
): void {
  createModelMatrix(position, rotation, scale, modelMatrix);
}