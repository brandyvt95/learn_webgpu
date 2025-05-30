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
struct RenderParams {
  modelViewProjectionMatrix : mat4x4f,
  right : vec3f,
  up : vec3f
}
@binding(0) @group(0) var<uniform> render_params : RenderParams;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  // Tính height từ noise theo uv hoặc position.xy
  let height = noise(input.uv * 1.0) * 2.0; // scale và độ cao displacement

  // Dịch vertex lên theo trục y (height)
  let displacedPos = vec3<f32>(input.position.x, height, input.position.z);


// Xoay -90 độ (mặt đứng → nằm ngang)
let rotated = rotateX(input.position, -3.15708); // -PI/2
  output.Position =  render_params.modelViewProjectionMatrix *  vec4<f32>(rotated * 5., 1.0);
  output.vUV = input.uv;
  output.vHeight = height;

  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  return vec4<f32>(input.vUV, 1.0, 1.0);

}
