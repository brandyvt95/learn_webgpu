// Whale.glb Vertex attributes
// Read in VertexInput from attributes
// f32x3    f32x3   f32x2       u8x4       f32x4
struct VertexOutput {
  @builtin(position) Position: vec4f,
  @location(0) normal: vec3f,
  @location(1) joints: vec4f,
  @location(2) weights: vec4f,
}
 
struct CameraUniforms {
  modelMatrix : mat4x4<f32>,
  viewMatrix : mat4x4<f32>,
  projectionMatrix : mat4x4<f32>,
  cameraPosition : vec3<f32>,
  padding : f32, // <- để giữ alignment 16 bytes
}

struct GeneralUniforms {
  render_mode: u32,
  skin_mode: u32,
}

struct NodeUniforms {
  world_matrix: mat4x4f,
}

@group(0) @binding(0) var<uniform> camera_uniforms: CameraUniforms;
@group(1) @binding(0) var<uniform> general_uniforms: GeneralUniforms;
@group(2) @binding(0) var<uniform> node_uniforms: NodeUniforms;
@group(3) @binding(0) var<storage, read> joint_matrices: array<mat4x4f>;
@group(3) @binding(1) var<storage, read> inverse_bind_matrices: array<mat4x4f>;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  // Compute joint_matrices * inverse_bind_matrices
  let joint0 = joint_matrices[input.joints[0]] * inverse_bind_matrices[input.joints[0]];
  let joint1 = joint_matrices[input.joints[1]] * inverse_bind_matrices[input.joints[1]];
  let joint2 = joint_matrices[input.joints[2]] * inverse_bind_matrices[input.joints[2]];
  let joint3 = joint_matrices[input.joints[3]] * inverse_bind_matrices[input.joints[3]];
  // Compute influence of joint based on weight
  let skin_matrix = 
    joint0 * input.weights[0] +
    joint1 * input.weights[1] +
    joint2 * input.weights[2] +
    joint3 * input.weights[3];
  // Position of the vertex relative to our world
  let world_position = vec4f(input.position.x, input.position.y, input.position.z, 1.0);
  // Vertex position with model rotation, skinning, and the mesh's node transformation applied.
  let skinned_position = camera_uniforms.modelMatrix  * node_uniforms.world_matrix * skin_matrix * world_position;
  // Vertex position with only the model rotation applied.
  let rotated_position = camera_uniforms.modelMatrix * world_position;

  let skinned_pos = skin_matrix * world_position;
  let node_pos = node_uniforms.world_matrix * skinned_pos;
  // Determine which position to used based on whether skinMode is turnd on or off.
  let transformed_position = select(
    rotated_position,
    skinned_position,
    general_uniforms.skin_mode == 0
  );
  let scaleFactor = .1; // ví dụ scale 2 lần

// Sau khi chọn vị trí transform (đã hoặc chưa skinning)
let transformed_position_scaled = vec4<f32>(transformed_position.xyz * scaleFactor, transformed_position.w);

// Áp dụng view và projection
output.Position = camera_uniforms.projectionMatrix * camera_uniforms.viewMatrix * skinned_position;

  output.normal = input.normal;
  // Convert u32 joint data to f32s to prevent flat interpolation error.
  output.joints = vec4f(f32(input.joints[0]), f32(input.joints[1]), f32(input.joints[2]), f32(input.joints[3]));
  output.weights = input.weights;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  switch general_uniforms.render_mode {
    case 1: {
      return input.joints;
    } 
    case 2: {
      return input.weights;
    }
    default: {
      return vec4f(input.normal, 1.0);
    }
  }
}