// Vertex buffer constants
export const cubeVertexSize = 4 * 10; // Byte size of one cube vertex (40 bytes)
export const cubePositionOffset = 0;
export const cubeColorOffset = 4 * 4; // Byte offset of cube vertex color attribute
export const cubeUVOffset = 4 * 8;

// Using indexed rendering - 24 unique vertices (4 per face for proper UV mapping)
export const cubeVertexCount = 24;
export const cubeIndexCount = 36;

// 24 unique vertices - mỗi face có 4 vertices riêng để UV mapping đúng
// Format: [x, y, z, w, r, g, b, a, u, v]
export const cubeVertexArray = new Float32Array([
  // BOTTOM face (y = -1, normal pointing down)
  -1, -1, -1, 1,  1, 0, 0, 1,  0, 0,  // 0
   1, -1, -1, 1,  1, 0, 0, 1,  1, 0,  // 1  
   1, -1,  1, 1,  1, 0, 0, 1,  1, 1,  // 2
  -1, -1,  1, 1,  1, 0, 0, 1,  0, 1,  // 3

  // TOP face (y = 1, normal pointing up)  
  -1,  1, -1, 1,  0, 1, 0, 1,  0, 0,  // 4
   1,  1, -1, 1,  0, 1, 0, 1,  1, 0,  // 5
   1,  1,  1, 1,  0, 1, 0, 1,  1, 1,  // 6
  -1,  1,  1, 1,  0, 1, 0, 1,  0, 1,  // 7

  // FRONT face (z = 1, normal pointing toward viewer)
  -1, -1,  1, 1,  0, 0, 1, 1,  0, 0,  // 8
   1, -1,  1, 1,  0, 0, 1, 1,  1, 0,  // 9
   1,  1,  1, 1,  0, 0, 1, 1,  1, 1,  // 10
  -1,  1,  1, 1,  0, 0, 1, 1,  0, 1,  // 11

  // BACK face (z = -1, normal pointing away from viewer)
   1, -1, -1, 1,  1, 1, 0, 1,  0, 0,  // 12
  -1, -1, -1, 1,  1, 1, 0, 1,  1, 0,  // 13
  -1,  1, -1, 1,  1, 1, 0, 1,  1, 1,  // 14
   1,  1, -1, 1,  1, 1, 0, 1,  0, 1,  // 15

  // LEFT face (x = -1, normal pointing left)
  -1, -1, -1, 1,  1, 0, 1, 1,  0, 0,  // 16
  -1, -1,  1, 1,  1, 0, 1, 1,  1, 0,  // 17
  -1,  1,  1, 1,  1, 0, 1, 1,  1, 1,  // 18
  -1,  1, -1, 1,  1, 0, 1, 1,  0, 1,  // 19

  // RIGHT face (x = 1, normal pointing right)
   1, -1, -1, 1,  0, 1, 1, 1,  0, 0,  // 20
   1, -1,  1, 1,  0, 1, 1, 1,  1, 0,  // 21
   1,  1,  1, 1,  0, 1, 1, 1,  1, 1,  // 22
   1,  1, -1, 1,  0, 1, 1, 1,  0, 1,  // 23
]);
export const cubeVertexOriginArray = new Float32Array([
  // BOTTOM face (y = -1, normal pointing down)
  -1, -1, -1, 1, 
   1, -1, -1, 1, 
   1, -1,  1, 1,  
  -1, -1,  1, 1,  

  // TOP face (y = 1, normal pointing up)  
  -1,  1, -1, 1, 
   1,  1, -1, 1, 
   1,  1,  1, 1,
  -1,  1,  1, 1, 

  // FRONT face (z = 1, normal pointing toward viewer)
  -1, -1,  1, 1, 
   1, -1,  1, 1, 
   1,  1,  1, 1, 
  -1,  1,  1, 1,  

  // BACK face (z = -1, normal pointing away from viewer)
   1, -1, -1, 1, 
  -1, -1, -1, 1, 
  -1,  1, -1, 1,  
   1,  1, -1, 1, 

  // LEFT face (x = -1, normal pointing left)
  -1, -1, -1, 1,  
  -1, -1,  1, 1, 
  -1,  1,  1, 1,  
  -1,  1, -1, 1,  

  // RIGHT face (x = 1, normal pointing right)
   1, -1, -1, 1, 
   1, -1,  1, 1,  
   1,  1,  1, 1, 
   1,  1, -1, 1, 
]);

// Index buffer - định nghĩa thứ tự vertices tạo thành triangles
export const cubeIndices = new Uint16Array([
  // Bottom (looking from below, CCW)
  0, 1, 2,   0, 2, 3,
  
  // Top (looking from above, CCW)
  4, 6, 5,   4, 7, 6,
  
  // Front (CCW from outside)
  8, 10, 9,   8, 11, 10,
  
  // Back (CCW from outside) 
  12, 13, 14,  12, 14, 15,
  
  // Left (CCW from outside)
  16, 17, 18,  16, 18, 19,
  
  // Right (CCW from outside)
  20, 22, 21,  20, 23, 22,
]);

// Alternative: Super optimized version với chỉ 8 vertices
export const cubeVertexArrayOptimized = new Float32Array([
  // 8 unique corner vertices
  // Format: [x, y, z, w, r, g, b, a, u, v]
  -1, -1, -1, 1,  0, 0, 0, 1,  0, 0,  // 0: back-bottom-left
   1, -1, -1, 1,  1, 0, 0, 1,  1, 0,  // 1: back-bottom-right
   1, -1,  1, 1,  1, 0, 1, 1,  1, 1,  // 2: front-bottom-right
  -1, -1,  1, 1,  0, 0, 1, 1,  0, 1,  // 3: front-bottom-left
  -1,  1, -1, 1,  0, 1, 0, 1,  0, 0,  // 4: back-top-left
   1,  1, -1, 1,  1, 1, 0, 1,  1, 0,  // 5: back-top-right
   1,  1,  1, 1,  1, 1, 1, 1,  1, 1,  // 6: front-top-right
  -1,  1,  1, 1,  0, 1, 1, 1,  0, 1,  // 7: front-top-left
]);

export const cubeIndicesOptimized = new Uint16Array([
  // Bottom face
  0, 2, 1,   0, 3, 2,
  // Top face  
  4, 5, 6,   4, 6, 7,
  // Front face
  3, 6, 2,   3, 7, 6,
  // Back face
  1, 4, 0,   1, 5, 4,
  // Left face
  0, 7, 3,   0, 4, 7,
  // Right face
  2, 5, 1,   2, 6, 5,
]);

export const cubeVertexCountOptimized = 8;

/* 
USAGE EXAMPLE:

// Setup vertex buffer
const vertexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeVertexArray, gl.STATIC_DRAW);

// Setup index buffer
const indexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW);

// Setup vertex attributes
const positionLocation = gl.getAttribLocation(program, 'position');
const colorLocation = gl.getAttribLocation(program, 'color');
const uvLocation = gl.getAttribLocation(program, 'uv');

gl.enableVertexAttribArray(positionLocation);
gl.enableVertexAttribArray(colorLocation);
gl.enableVertexAttribArray(uvLocation);

gl.vertexAttribPointer(positionLocation, 4, gl.FLOAT, false, cubeVertexSize, cubePositionOffset);
gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, cubeVertexSize, cubeColorOffset);
gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, cubeVertexSize, cubeUVOffset);

// Enable depth testing to prevent face overlap issues
gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);
gl.cullFace(gl.BACK);

// Clear and draw
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
gl.drawElements(gl.TRIANGLES, cubeIndexCount, gl.UNSIGNED_SHORT, 0);
*/