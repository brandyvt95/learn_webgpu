

  // Hàm tạo ma trận xoay quanh axis góc angle (theo trục)
  fn rotationMatrix(axis: vec3<f32>, angle: f32) -> mat3x3<f32> {
    let c = cos(angle);
    let s = sin(angle);
    let t = 1.0 - c;

    return mat3x3<f32>(
      vec3<f32>(t * axis.x * axis.x + c,         t * axis.x * axis.y - s * axis.z, t * axis.x * axis.z + s * axis.y),
      vec3<f32>(t * axis.x * axis.y + s * axis.z, t * axis.y * axis.y + c,         t * axis.y * axis.z - s * axis.x),
      vec3<f32>(t * axis.x * axis.z - s * axis.y, t * axis.y * axis.z + s * axis.x, t * axis.z * axis.z + c)
    );
  }


struct CameraUniforms {
  modelMatrix : mat4x4<f32>,
  viewMatrix : mat4x4<f32>,
  projectionMatrix : mat4x4<f32>,
  cameraPosition : vec3<f32>,
  padding : f32, // <- để giữ alignment 16 bytes
}
@group(0) @binding(0) var<uniform> camera_uniforms: CameraUniforms;
@group(1) @binding(0) var<uniform> uTime: f32;
@group(2) @binding(0) var<storage, read> points: array<vec3<f32>>;
@group(3) @binding(0) var<storage, read> pointss: array<vec3<f32>>;
@group(3) @binding(1) var<storage, read> segmentMeta: array<vec4<u32>>;
struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) fragUV : vec2f,
  @location(1) fragPosition: vec4f,
}




@vertex
fn main(
  @builtin(instance_index) instanceIdx : u32,
  @location(0) position : vec4f,
  @location(1) uv : vec2f
) -> VertexOutput {
  var output : VertexOutput;
// Lấy 2 điểm cho instance hiện tại
let A = pointss[instanceIdx * 2];       // lấy vec3 tại điểm 2 * instanceIdx
let B = pointss[instanceIdx * 2 + 1];   // lấy vec3 ngay sau đó

let dir = normalize(B - A);
let len = distance(B, A);
let defaultDir = vec3<f32>(1.0, 0.0, 0.0);
let axis = cross(defaultDir, dir);
let axisLength = length(axis);
let cosAngle = dot(defaultDir, dir);
let angle = acos(cosAngle);
var rot: mat3x3<f32>;
if (axisLength < 0.0001) {
  // Hai vector gần như trùng nhau hoặc ngược nhau
  if (cosAngle > 0.0) {
    // Cùng hướng, ma trận xoay là ma trận đơn vị
    rot = mat3x3<f32>(
      vec3<f32>(1.0, 0.0, 0.0),
      vec3<f32>(0.0, 1.0, 0.0),
      vec3<f32>(0.0, 0.0, 1.0)
    );
  } else {
    // Ngược hướng, xoay 180 độ quanh trục bất kỳ vuông góc
    // Ví dụ trục Y
    rot = rotationMatrix(vec3<f32>(0.0, 1.0, 0.0), 3.1415926);
  }
} else {
  // Bình thường, tạo ma trận xoay quanh axis với góc angle
  rot = rotationMatrix(normalize(axis), angle);
}
let t = clamp(uTime * 0.5, 0.0, 1.0); 
let scaleVec = vec3<f32>(t * len, 0.01,0.01);
let pivotStart = vec3<f32>(1., 0.0, 0.0);
let localPos = position.xyz - pivotStart; 
let scaled = localPos * scaleVec;
let rotated = rot * scaled;

let finalPos = A + rotated;


  output.Position = camera_uniforms.projectionMatrix *
                    camera_uniforms.viewMatrix *
                    vec4<f32>(finalPos, 1.0);

  output.fragUV = uv;
  output.fragPosition = 0.5 * (position + vec4(1.0));

  return output;
}
