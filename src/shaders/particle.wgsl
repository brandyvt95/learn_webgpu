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

////////////////////////////////////////////////////////////////////////////////
// Vertex shader
////////////////////////////////////////////////////////////////////////////////
struct RenderParams {
  modelViewProjectionMatrix : mat4x4f,
  right : vec3f,
  up : vec3f
}
@binding(0) @group(0) var<uniform> render_params : RenderParams;

struct VertexInput {
  @location(0) position : vec3f,
  @location(1) color : vec4f,
  @location(2) quad_pos : vec2f, // -1..+1
}

struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) color : vec4f,
  @location(1) quad_pos : vec2f, // -1..+1
}

@vertex
fn vs_main(in : VertexInput) -> VertexOutput {
  var quad_pos = mat2x3f(render_params.right, render_params.up) * in.quad_pos;
  var position = in.position + quad_pos * 0.01;
  var out : VertexOutput;
  out.position = render_params.modelViewProjectionMatrix * vec4f(position, 1.0);
  out.color = in.color;
  out.quad_pos = in.quad_pos;
  return out;
}

////////////////////////////////////////////////////////////////////////////////
// Fragment shader
////////////////////////////////////////////////////////////////////////////////
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  var dist = length(in.quad_pos);
  if (dist > 1.0) {
    // Trả về trong suốt -> "discard"
    return vec4f(0.0, 0.0, 0.0, 0.0);
  }
  var color = in.color;
  // Áp dụng alpha mask theo hình tròn mềm (optional)
  //color.a = color.a * (1.0 - dist);
  return color;
}


////////////////////////////////////////////////////////////////////////////////
// Simulation Compute shader
////////////////////////////////////////////////////////////////////////////////
struct SimulationParams {
  deltaTime : f32,
  brightnessFactor : f32,
  seed : vec4f,
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

// Hash function để sinh giá trị ngẫu nhiên (dùng trong noise)
fn hash(p: vec3<f32>) -> f32 {
    let h = dot(p, vec3<f32>(127.1, 311.7, 74.7));
    return fract(sin(h) * 43758.5453123);
}

// Lerp (linear interpolation)
fn lerp(a: f32, b: f32, t: f32) -> f32 {
    return a + t * (b - a);
}

// fade curve (ease curve) của Perlin noise
fn fade(t: f32) -> f32 {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// Hàm noise 3D đơn giản (classic Perlin noise)
fn snoise(p: vec3<f32>) -> f32 {
    let i = vec3<f32>(floor(p.x), floor(p.y), floor(p.z));
    let f = vec3<f32>(fract(p.x), fract(p.y), fract(p.z));

    // 8 điểm góc của cube
    let a = hash(i);
    let b = hash(i + vec3<f32>(1.0, 0.0, 0.0));
    let c = hash(i + vec3<f32>(0.0, 1.0, 0.0));
    let d = hash(i + vec3<f32>(1.0, 1.0, 0.0));
    let e = hash(i + vec3<f32>(0.0, 0.0, 1.0));
    let f1 = hash(i + vec3<f32>(1.0, 0.0, 1.0));
    let g = hash(i + vec3<f32>(0.0, 1.0, 1.0));
    let h = hash(i + vec3<f32>(1.0, 1.0, 1.0));

    // fade curve
    let u = vec3<f32>(fade(f.x), fade(f.y), fade(f.z));

    // lerp từng trục
    let lerp_x1 = lerp(a, b, u.x);
    let lerp_x2 = lerp(c, d, u.x);
    let lerp_x3 = lerp(e, f1, u.x);
    let lerp_x4 = lerp(g, h, u.x);

    let lerp_y1 = lerp(lerp_x1, lerp_x2, u.y);
    let lerp_y2 = lerp(lerp_x3, lerp_x4, u.y);

    let lerp_z = lerp(lerp_y1, lerp_y2, u.z);

    return lerp_z * 2.0 - 1.0; // normalize output -1..1
}

fn curlNoise(p: vec3<f32>) -> vec3<f32> {
  let e = 0.1;
  
  let dx = vec3<f32>(e, 0.0, 0.0);
  let dy = vec3<f32>(0.0, e, 0.0);
  let dz = vec3<f32>(0.0, 0.0, e);

  // tính đạo hàm đạo hàm chéo (partial derivatives) theo hữu hạn
  let dn_dy = (snoise(p + dy) - snoise(p - dy)) / (2.0 * e);
  let dn_dz = (snoise(p + dz) - snoise(p - dz)) / (2.0 * e);
  let curl_x = dn_dz - dn_dy;

  let dn_dz_2 = (snoise(p + dz) - snoise(p - dz)) / (2.0 * e);
  let dn_dx = (snoise(p + dx) - snoise(p - dx)) / (2.0 * e);
  let curl_y = dn_dx - dn_dz_2;

  let dn_dx_2 = (snoise(p + dx) - snoise(p - dx)) / (2.0 * e);
  let dn_dy_2 = (snoise(p + dy) - snoise(p - dy)) / (2.0 * e);
  let curl_z = dn_dy_2 - dn_dx_2;

  return vec3<f32>(curl_x, curl_y, curl_z);
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
  //particle.velocity.x = particle.velocity.x - sim_params.deltaTime * 0.5;

    let curl = curlNoise(particle.position * 1. + sim_params.deltaTime * .1);
    particle.velocity += curl * .01;

  // Basic velocity integration
  particle.position = particle.position + sim_params.deltaTime * particle.velocity;

  // Age each particle. Fade out before vanishing.
  particle.lifetime = particle.lifetime - sim_params.deltaTime;
  particle.color.a = smoothstep(0.0, 0.9, particle.lifetime);

  // If the lifetime has gone negative, then the particle is dead and should be
  // respawned.
  if (particle.lifetime < 0.0) {
    // Use the probability map to find where the particle should be spawned.
    // Starting with the 1x1 mip level.
    var coord : vec2i;
    for (var level = u32(textureNumLevels(texture) - 1); level > 0; level--) {
      // Load the probability value from the mip-level
      // Generate a random number and using the probabilty values, pick the
      // next texel in the next largest mip level:
      //
      // 0.0    probabilites.r    probabilites.g    probabilites.b   1.0
      //  |              |              |              |              |
      //  |   TOP-LEFT   |  TOP-RIGHT   | BOTTOM-LEFT  | BOTTOM_RIGHT |
      //
      let probabilites = textureLoad(texture, coord, level);
      let value = vec4f(rand());
      let mask = (value >= vec4f(0.0, probabilites.xyz)) & (value < probabilites);
      coord = coord * 2;
      coord.x = coord.x + select(0, 1, any(mask.yw)); // x  y
      coord.y = coord.y + select(0, 1, any(mask.zw)); // z  w
    }
    let uv = vec2f(coord) / vec2f(textureDimensions(texture));
    particle.position = vec3f((uv - 0.5) * 1.0 * vec2f(1.0, -1.0), 0.0);
    particle.color = textureLoad(texture, coord, 0);
    particle.velocity.x = 0.;
    particle.velocity.y = 0.;
    particle.velocity.z = 0.;
    particle.lifetime = 0.5 + rand() * 3.0;
  }

  // Store the new particle value
  data.particles[idx] = particle;
}
