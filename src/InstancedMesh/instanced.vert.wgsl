

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
struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) fragUV : vec2f,
  @location(1) fragPosition: vec4f,
 @location(2) @interpolate(flat) instanceIdx: u32,
}

@group(0) @binding(0) var<uniform> camera_uniforms: CameraUniforms;
@group(1) @binding(0) var<uniform> uTime: f32;
@group(2) @binding(0) var<storage, read> points: array<vec3<f32>>;
@group(3) @binding(0) var<storage, read> pointss: array<f32>;
@group(3) @binding(1) var<storage, read> segmentMeta: array<vec4<u32>>;

@vertex
fn main(
  @builtin(instance_index) instanceIdx : u32,
  @location(0) position : vec4f,
  @location(1) uv : vec2f
) -> VertexOutput {
  var output : VertexOutput;
  
let baseIndex = instanceIdx * 6u;

let A = vec3<f32>(
  pointss[baseIndex + 0u],
  pointss[baseIndex + 1u],
  pointss[baseIndex + 2u]
);

let B = vec3<f32>(
  pointss[baseIndex + 3u],
  pointss[baseIndex + 4u],
  pointss[baseIndex + 5u]
);
 let direction = B - A;
let segmentLength = length(direction);
let forward = normalize(direction);

// ✅ Chọn up vector tự động tránh parallel
var up = vec3<f32>(0.0, 1.0, 0.0);
if (abs(dot(forward, up)) > 0.9) {  // Nếu gần song song
    up = vec3<f32>(1.0, 0.0, 0.0);  // Dùng trục X thay thế
}

let right = normalize(cross(forward, up));
let actualUp = normalize(cross(right, forward));  // ✅ Tính lại up chính xác
    
    // Scale cube theo thời gian: từ 0 đến segmentLength
    let currentLength = mix(0.,segmentLength,clamp(0.,1.,uTime * .2)) ;
    
    let scaledPos = vec3<f32>(
        position.x * 0.05,  // thickness cố định
        position.y * currentLength * 0.5,  // length từ 0 đến segmentLength/2
        position.z * 0.05   // thickness cố định
    );
    
    // ✅ QUAN TRỌNG: Center luôn cách A một khoảng currentLength/2
    // Cube sẽ bắt đầu tại A, mở rộng về phía B
    let center = A + forward * (currentLength * 0.5);
    
    // Transform cube position
    var worldPos = center + 
        right * scaledPos.x + 
        forward * scaledPos.y + 
        actualUp * scaledPos.z;
    worldPos.y -= 4.5;
  output.Position = camera_uniforms.projectionMatrix *
                    camera_uniforms.viewMatrix *
                    vec4<f32>(worldPos  * .1, 1.0);

  output.fragUV = uv;
  output.fragPosition = 0.5 * (position + vec4(1.0));
  output.instanceIdx = instanceIdx;
  return output;
}
