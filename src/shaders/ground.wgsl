// ground.wgsl

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) vUV: vec2<f32>,
  @location(1) vHeight: f32,
};

fn hash(p: vec2<f32>) -> f32 {
  let h = dot(p, vec2<f32>(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

fn noise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);

  let a = hash(i);
  let b = hash(i + vec2<f32>(1.0, 0.0));
  let c = hash(i + vec2<f32>(0.0, 1.0));
  let d = hash(i + vec2<f32>(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
fn rotateX(p: vec3<f32>, angle: f32) -> vec3<f32> {
  let c = cos(angle);
  let s = sin(angle);
  return vec3<f32>(
    p.x,
    c * p.y - s * p.z,
    s * p.y + c * p.z
  );
}
struct ObjectUniforms {
  x : f32,
  y : f32,
  z : f32,
  w : f32
}
struct CameraUniforms {
  modelViewProjectionMatrix : mat4x4f,
  right : vec3f,
  up : vec3f
}
@group(0) @binding(0) var<uniform> obj_uniforms : ObjectUniforms;
@group(1) @binding(0) var<uniform> camera_uniforms: CameraUniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let rotated = rotateX(input.position, -3.15708);
  let offset = vec3<f32>(0.0, obj_uniforms.y, 0.0); 
  output.Position =  camera_uniforms.modelViewProjectionMatrix *  vec4<f32>(rotated * 5. + offset, 1.0);
  output.vUV = input.uv;
  output.vHeight = 1.;

  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  return vec4<f32>(input.vUV, 1.0, 1.0);

}
