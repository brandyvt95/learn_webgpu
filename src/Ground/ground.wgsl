// ground.wgsl

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

 struct DirectionalLight {
    direction: vec3f,
    color: vec3f,
    intensity: f32,
  };

  struct PointLight {
    position: vec3f,
    range: f32,
    color: vec3f,
    intensity: f32,
  };

  struct Lights {
    ambient: vec3f,
    directionalLight: DirectionalLight,
    pointLightCount: u32,
    pointLights: array<PointLight>,
  };

  
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) vUV: vec2<f32>,
  @location(1) vPos:  vec3<f32>,
};

struct CameraUniforms {
  modelMatrix : mat4x4<f32>,
  viewMatrix : mat4x4<f32>,
  projectionMatrix : mat4x4<f32>,
  cameraPosition : vec3<f32>,
  padding : f32, // <- để giữ alignment 16 bytes
}
@group(0) @binding(0) var<uniform> camera_uniforms: CameraUniforms;
@group(0) @binding(1) var<storage> lights : Lights;
//@group(0) @binding(1) var<storage, read_write> camera_uniformsd : array<u32>;
@group(1) @binding(0) var<uniform> obj_uniforms : ObjectUniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let rotated = rotateX(input.position, -3.15708);
 
  let offset = vec3<f32>(0.,  -obj_uniforms.y, 0.0); 
  output.Position = camera_uniforms.projectionMatrix * camera_uniforms.viewMatrix  *  camera_uniforms.modelMatrix *  vec4<f32>(rotated * 5. + offset, 1.0);
  output.vUV = input.uv;
  output.vPos = input.position.xyz;

  return output;
}

  @group(0) @binding(2) var environmentSampler : sampler;
  @group(0) @binding(3) var environmentTexture : texture_cube<f32>;

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
   let og = lights.ambient.x;
      let eye = camera_uniforms.cameraPosition;
 // 
 let tex =  input.vPos;
  //return textureSample(environmentTexture, environmentSampler, tex);
  return vec4<f32>(input.vUV , 1.0, 1.0);
}
