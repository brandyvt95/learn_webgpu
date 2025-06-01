////////////////////////////////////////////////////////////////////////////////
// Utilities
////////////////////////////////////////////////////////////////////////////////
var<private> rand_seed : vec2f;

fn init_rand(invocation_id : u32, seed : vec4f) {
  rand_seed = seed.xz;
  rand_seed = fract(rand_seed * cos(35.456+f32(invocation_id) * seed.yw));
  rand_seed = fract(rand_seed * cos(41.235+f32(invocation_id) * seed.xw));
}

fn rand() -> f32 {
  rand_seed.x = fract(cos(dot(rand_seed, vec2f(23.14077926, 232.61690225))) * 136.8168);
  rand_seed.y = fract(cos(dot(rand_seed, vec2f(54.47856553, 345.84153136))) * 534.7645);
  return rand_seed.y;
}
// Frame rate independent interpolation functions
// fn lerpCoefFPS(t: f32, dt: f32) -> f32 {
//     return 1.0 - exp2(log2(1.0 - t) * dt);
// }

// fn frictionFPS(t: f32, dt: f32) -> f32 {
//     return exp2(log2(t) * dt);
// }

// fn lerpFPS(x: f32, y: f32, t: f32, dt: f32) -> f32 {
//     return mix(x, y, lerpCoefFPS(t, dt));
// }

// ============================================================================
// BEAUTIFUL CURL NOISE FOR WGSL
// Optimized for fluid simulation and particle systems
// ============================================================================

// Simple hash function for noise generation
fn hash31(p: vec3<f32>) -> f32 {
    var p3 = fract(p * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

fn hash33(p: vec3<f32>) -> vec3<f32> {
    var p3 = fract(p * vec3<f32>(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yxx) * p3.zyx);
}

// Smooth noise function
fn noise(p: vec3<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    
    return mix(
        mix(
            mix(hash31(i + vec3<f32>(0.0, 0.0, 0.0)), 
                hash31(i + vec3<f32>(1.0, 0.0, 0.0)), u.x),
            mix(hash31(i + vec3<f32>(0.0, 1.0, 0.0)), 
                hash31(i + vec3<f32>(1.0, 1.0, 0.0)), u.x), u.y),
        mix(
            mix(hash31(i + vec3<f32>(0.0, 0.0, 1.0)), 
                hash31(i + vec3<f32>(1.0, 0.0, 1.0)), u.x),
            mix(hash31(i + vec3<f32>(0.0, 1.0, 1.0)), 
                hash31(i + vec3<f32>(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}

// Vector noise using hash33
fn vnoise(p: vec3<f32>) -> vec3<f32> {
    return hash33(p) * 2.0 - 1.0;
}

// Fractal Brownian Motion (fBm) for more detailed noise
fn fbm(p: vec3<f32>) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    
    for (var i = 0; i < 4; i++) {
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    
    return value;
}

// Vector fBm
fn vfbm(p: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(
        fbm(p + vec3<f32>(0.0, 0.0, 0.0)),
        fbm(p + vec3<f32>(5.2, 1.3, 0.0)),
        fbm(p + vec3<f32>(0.0, 5.7, 11.1))
    );
}

// High quality curl noise using analytical derivatives
fn curlNoise(p: vec3<f32>) -> vec3<f32> {
    let eps = 0.001;
    
    // Sample noise at slightly offset positions
    let dx = vec3<f32>(eps, 0.0, 0.0);
    let dy = vec3<f32>(0.0, eps, 0.0);
    let dz = vec3<f32>(0.0, 0.0, eps);
    
    // Get vector field samples
    let p_x0 = vfbm(p - dx);
    let p_x1 = vfbm(p + dx);
    let p_y0 = vfbm(p - dy);
    let p_y1 = vfbm(p + dy);
    let p_z0 = vfbm(p - dz);
    let p_z1 = vfbm(p + dz);
    
    // Compute curl using finite differences
    let curl = vec3<f32>(
        (p_y1.z - p_y0.z) - (p_z1.y - p_z0.y),
        (p_z1.x - p_z0.x) - (p_x1.z - p_x0.z),
        (p_x1.y - p_x0.y) - (p_y1.x - p_y0.x)
    ) / (2.0 * eps);
    
    return curl;
}

// Simplified curl noise (faster but less detailed)
fn simpleCurlNoise(p: vec3<f32>) -> vec3<f32> {
    let eps = 0.01;
    
    // Use simple noise for faster computation
    let n1 = noise(p + vec3<f32>(eps, 0.0, 0.0)) - noise(p - vec3<f32>(eps, 0.0, 0.0));
    let n2 = noise(p + vec3<f32>(0.0, eps, 0.0)) - noise(p - vec3<f32>(0.0, eps, 0.0));
    let n3 = noise(p + vec3<f32>(0.0, 0.0, eps)) - noise(p - vec3<f32>(0.0, 0.0, eps));
    
    return vec3<f32>(n2 - n3, n3 - n1, n1 - n2) / (2.0 * eps);
}

// Layered curl noise for more complexity
fn layeredCurlNoise(p: vec3<f32>, octaves: i32) -> vec3<f32> {
    var result = vec3<f32>(0.0);
    var amplitude = 1.0;
    var frequency = 1.0;
    
    for (var i = 0; i < octaves; i++) {
        result += amplitude * curlNoise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    
    return result;
}

// Time-varying curl noise for animation
fn animatedCurlNoise(p: vec3<f32>, time: f32) -> vec3<f32> {
    let p_animated = p + vec3<f32>(
        sin(time * 0.1) * 0.5,
        cos(time * 0.15) * 0.3,
        sin(time * 0.12) * 0.4
    );
    
    return curlNoise(p_animated);
}

// Turbulent curl noise with domain warping
fn turbulentCurlNoise(p: vec3<f32>) -> vec3<f32> {
    // Domain warping for more organic look
    let warp = vfbm(p * 15.5) * 0.02;
    let warped_p = p + warp;
    
    return curlNoise(warped_p * .1);
}

// Ridged curl noise (creates sharp ridges)
fn ridgedCurlNoise(p: vec3<f32>) -> vec3<f32> {
    let curl = curlNoise(p);
    return abs(curl) * 2.0 - 1.0;
}

// Billow curl noise (creates puffy clouds effect)
fn billowCurlNoise(p: vec3<f32>) -> vec3<f32> {
    return abs(curlNoise(p));
}

// Main curl noise function with multiple options
fn getCurlNoise(p: vec3<f32>, noiseType: i32, time: f32) -> vec3<f32> {
    switch (noiseType) {
        case 0: { return curlNoise(p); }                           // High quality
        case 1: { return simpleCurlNoise(p); }                     // Fast
        case 2: { return layeredCurlNoise(p, 3); }                 // Detailed
        case 3: { return animatedCurlNoise(p, time); }             // Animated
        case 4: { return turbulentCurlNoise(p); }                  // Turbulent
        case 5: { return ridgedCurlNoise(p); }                     // Ridged
        case 6: { return billowCurlNoise(p); }                     // Billow
        default: { return curlNoise(p); }
    }
}

// Utility function for normalizing curl noise
fn normalizedCurlNoise(p: vec3<f32>) -> vec3<f32> {
    let curl = curlNoise(p);
    let len = length(curl);
    if (len > 0.0) {
        return curl / len;
    }
    return vec3<f32>(0.0);
}

// Curl noise with controllable strength
fn curlNoiseWithStrength(p: vec3<f32>, strength: f32) -> vec3<f32> {
    return curlNoise(p) * strength;
}
fn rotX(angle: f32) -> mat3x3<f32> {
    let s = sin(angle);
    let c = cos(angle);
    return mat3x3<f32>(
        vec3<f32>(1.0, 0.0, 0.0),
        vec3<f32>(0.0, c, s),
        vec3<f32>(0.0, -s, c)
    );
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////


struct PointUniforms {
  pointSize : f32,     
  radFade:f32,   
  // padding 12 bytes (4f) if empty
  pointColor: vec3<f32>,
}
struct CameraUniforms {
  modelMatrix : mat4x4<f32>,
  viewMatrix : mat4x4<f32>,
  projectionMatrix : mat4x4<f32>,
  cameraPosition : vec3<f32>,
  padding : f32, // <- để giữ alignment 16 bytes
}
struct VertexInput {
  @location(0) position : vec3f,
  @location(1) color : vec4f,
  @location(2) quad_pos : vec2f, // -1..+1
  @location(3) extra : vec4f, 
}

struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) color : vec4f,
  @location(1) quad_pos : vec2f, // -1..+1
  @location(2) extra : vec4f, 
}

@group(0) @binding(0) var<uniform> point_uniforms : PointUniforms;
@group(1) @binding(0) var<uniform> camera_uniforms: CameraUniforms;

@vertex
fn vs_main(in : VertexInput) -> VertexOutput {
let view = camera_uniforms.viewMatrix;

let right = vec3f(camera_uniforms.viewMatrix[0][0],
                  camera_uniforms.viewMatrix[1][0],
                  camera_uniforms.viewMatrix[2][0]);

let up = vec3f(camera_uniforms.viewMatrix[0][1],
               camera_uniforms.viewMatrix[1][1],
               camera_uniforms.viewMatrix[2][1]);



  var quad_pos = mat2x3f(right,up) * in.quad_pos;
  var position = in.position + quad_pos * 0.0091 * point_uniforms.pointSize;
  var out : VertexOutput;
  out.position =  camera_uniforms.projectionMatrix * camera_uniforms.viewMatrix  *  camera_uniforms.modelMatrix  * vec4f(position, 1.0);
  //out.color = vec4f(point_uniforms.pointColor.xyz,1.);
    out.color = in.color * vec4f(point_uniforms.pointColor.xyz,1.);
  out.quad_pos = in.quad_pos;
  out.extra = vec4f(point_uniforms.radFade,1.,1.,1.);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    var dist = length(in.quad_pos);
     if (dist > 1.0) {
        return vec4f(0.0, 0.0, 0.0, 0.0);
    }
    //var alpha = smoothstep(in.extra.x, in.extra.x + .1, dist);
    var color = in.color;
    color.a = 1.;
    return color;

}


////////////////////////////////////////////////////////////////////////////////
// Simulation Compute shader
////////////////////////////////////////////////////////////////////////////////
struct SimulationParams {
  deltaTime: f32,
  snapFrame: f32,
  time:f32,
  seed: vec4f,
 // snapFrame: f32,
}


struct Particle {
  position : vec3f,
  lifetime : f32,
  color    : vec4f,
  velocity : vec3f,
}

struct Particles {
  particles : array<Particle>,
}


@binding(0) @group(0) var<uniform> sim_params : SimulationParams;
@binding(1) @group(0) var<storage, read_write> data : Particles;
@binding(2) @group(0) var texture : texture_2d<f32>;

@compute @workgroup_size(64)
fn simulate(@builtin(global_invocation_id) global_invocation_id : vec3u) {
  let idx = global_invocation_id.x;

  init_rand(idx, sim_params.seed);

  var particle = data.particles[idx];

 
  // Apply gravity
  let spatialScale = .01;
  
//    let force2 = BitangentNoise4D(vec4((particle.position) * spatialScale, sim_params.deltaTime * (1.0 + 0.1 * particle.lifetime))) * 3.1;

//   particle.velocity += force2 * .1;
  //particle.velocity.z -= .1;
  

 particle.velocity +=  getCurlNoise(particle.position * .7, 4, sim_params.deltaTime);
  particle.position = particle.position + sim_params.deltaTime * particle.velocity;


   particle.lifetime = particle.lifetime - 0.2;

  
  let speed = length(particle.velocity.xyz  );
  let speedNorm = clamp(speed , 0.0, 1.0); 
  particle.color = vec4f(speedNorm,speedNorm,speedNorm, 1.0);
  //particle.color = vec4f(.5,1.,.5, 1.0);
//  particle.color.a = smoothstep(0.0, 0.9, particle.lifetime);
  if (particle.lifetime < 0. ) {
      let textureWidth = 6000;
      let particleIndex = i32(global_invocation_id.x);

      let frameIndex0 = i32(floor(sim_params.snapFrame));
      let frameIndex1 = min(frameIndex0 + 1, 63 - 1); // giới hạn max frame

      var mixedColor: vec4<f32>;

      // Nếu particleIndex trong giới hạn texture width
      if (particleIndex < textureWidth) {
          let pos0 = vec2<i32>(particleIndex, frameIndex0);
          let pos1 = vec2<i32>(particleIndex, frameIndex1);

          let color0: vec4<f32> = textureLoad(texture, pos0, 0);
          let color1: vec4<f32> = textureLoad(texture, pos1, 0);

          let t: f32 = sim_params.snapFrame - floor(sim_params.snapFrame);

          mixedColor = mix(color0, color1, t);
      } else {
          // random nội suy giữa 2 pixel kế tiếp trong texture width

          // Tạo random float t dựa trên particleIndex
          let randT = fract(sin(f32(particleIndex) * 12.9898) * 43758.5453);

          // Tính index base trong texture
          let baseIndex0 = particleIndex % textureWidth;
          let baseIndex1 = min(baseIndex0 + 1, textureWidth - 1);

          // Lấy 2 pixel ở frameIndex0 (hoặc frameIndex1 đều được)
          let pos0 = vec2<i32>(baseIndex0, frameIndex0);
          let pos1 = vec2<i32>(baseIndex1, frameIndex0);

          let color0: vec4<f32> = textureLoad(texture, pos0, 0);
          let color1: vec4<f32> = textureLoad(texture, pos1, 0);

          mixedColor = mix(color0, color1, .5);
      }

      // Xoay vector nếu cần
     let rotated_xyz = rotX(-3.141592653589793 / 2.0) * mixedColor.xyz;

    //particle.position = vec3<f32>(rotated_xyz);

    // particle.position = vec3f( rand() *  2.0 - 1., rand() *  2.0 - 1.,rand() *  2.0 - 1.) * .09;
    
    //particle.velocity = vec3f( rand() *  2.0 - 1., rand() *  2.0 - 1., rand() *  2.0 - 1.);
    particle.velocity = vec3f(0.,0.,0.);
    particle.lifetime = 0.5 + rand() * 5.0;
  }
 
  var bound = 1.;
  if(particle.position.x > bound || particle.position.x < -bound || particle.position.y > bound || particle.position.y < -bound || particle.position.z > bound || particle.position.z < -bound) {
   // particle.velocity = vec3f(0.,0.,0.);
  }
  // Store the new particle value
  data.particles[idx] = particle;
}
