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
  var position = in.position + quad_pos * 0.0091;
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
  deltaTime: f32,
  snapFrame: f32,
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

// Hash function để sinh giá trị ngẫu nhiên (dùng trong noise)
fn mod289(x: vec4<f32>) -> vec4<f32> {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn mod289f(x: f32) -> f32 {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn permute(x: vec4<f32>) -> vec4<f32> {
    return mod289(((x * 34.0) + 1.0) * x);
}

fn permutef(x: f32) -> f32 {
    return mod289f(((x * 34.0) + 1.0) * x);
}

fn taylorInvSqrt(r: vec4<f32>) -> vec4<f32> {
    return vec4<f32>(1.79284291400159) - vec4<f32>(0.85373472095314) * r;
}

fn taylorInvSqrtf(r: f32) -> f32 {
    return 1.79284291400159 - 0.85373472095314 * r;
}

fn lessThanZero(x: vec4<f32>) -> vec4<f32> {
    return vec4<f32>(
        select(0.0, 1.0, x.x < 0.0),
        select(0.0, 1.0, x.y < 0.0),
        select(0.0, 1.0, x.z < 0.0),
        select(0.0, 1.0, x.w < 0.0)
    );
}

fn grad4(j: f32, ip: vec4<f32>) -> vec4<f32> {
    let ones = vec4<f32>(1.0, 1.0, 1.0, -1.0);
    var p: vec4<f32>;

    let j3 = vec3<f32>(j);
    var temp_xyz: vec3<f32> = floor(fract(j3 * ip.xyz) * 7.0) * ip.z - 1.0;
    p = vec4<f32>(temp_xyz, p.w);

    p.w = 1.5 - dot(abs(p.xyz), ones.xyz);

    let s = lessThanZero(p);
    var temp: vec4<f32> = s;

   p = vec4<f32>(
    p.xyz + (temp.xyz * 2.0 - vec3<f32>(1.0)) * vec3<f32>(temp.www),
    p.w
);

    return p;
}

fn snoise4(v: vec4<f32>) -> vec4<f32> {
    let C = vec4<f32>(0.138196601125011, 0.276393202250021, 0.414589803375032, -0.447213595499958);

    let i = floor(v + dot(v, vec4<f32>(0.309016994374947451)));

    let x0 = v - i + dot(i, vec4<f32>(C.x));

    var i0 = vec4<f32>(0.0);

    let isX = vec3<f32>(
        select(0.0, 1.0, x0.y > x0.x),
        select(0.0, 1.0, x0.z > x0.x),
        select(0.0, 1.0, x0.w > x0.x)
    );
    let isYZ = vec3<f32>(
        select(0.0, 1.0, x0.z > x0.y),
        select(0.0, 1.0, x0.w > x0.y),
        select(0.0, 1.0, x0.w > x0.z)
    );

    i0.x = isX.x + isX.y + isX.z;
    i0.y = 1.0 - isX.x;
    i0.z = 1.0 - isX.y;
    i0.w = 1.0 - isX.z;

    i0.y = i0.y + isYZ.x + isYZ.y;
    i0.z = i0.z + isYZ.z;
    i0.w = i0.w + (1.0 - isYZ.z);

    let i3 = clamp(i0, vec4<f32>(0.0), vec4<f32>(1.0));
    let i2 = clamp(i0 - vec4<f32>(1.0), vec4<f32>(0.0), vec4<f32>(1.0));
    let i1 = clamp(i0 - vec4<f32>(2.0), vec4<f32>(0.0), vec4<f32>(1.0));

    let x1 = x0 - i1 + vec4<f32>(C.x);
    let x2 = x0 - i2 + vec4<f32>(C.y);
    let x3 = x0 - i3 + vec4<f32>(C.z);
    let x4 = x0 + vec4<f32>(C.w);

    let ii = mod289(i);
    let j0 = permutef(permutef(permutef(permutef(ii.w) + ii.z) + ii.y) + ii.x);

    let j1 = vec4<f32>(
        permutef(permutef(permutef(permutef(
            ii.w + i1.w) + ii.z + i1.z) + ii.y + i1.y) + ii.x + i1.x),
        permutef(permutef(permutef(permutef(
            ii.w + i2.w) + ii.z + i2.z) + ii.y + i2.y) + ii.x + i2.x),
        permutef(permutef(permutef(permutef(
            ii.w + i3.w) + ii.z + i3.z) + ii.y + i3.y) + ii.x + i3.x),
        permutef(permutef(permutef(permutef(
            ii.w + 1.0) + ii.z + 1.0) + ii.y + 1.0) + ii.x + 1.0)
    );

    let ip = vec4<f32>(1.0 / 294.0, 1.0 / 49.0, 1.0 / 7.0, 0.0);

    let p0 = grad4(j0, ip);
    let p1 = grad4(j1.x, ip);
    let p2 = grad4(j1.y, ip);
    let p3 = grad4(j1.z, ip);
    let p4 = grad4(j1.w, ip);

    let norm = taylorInvSqrt(vec4<f32>(
        dot(p0, p0),
        dot(p1, p1),
        dot(p2, p2),
        dot(p3, p3)
    ));
    let norm4 = taylorInvSqrtf(dot(p4, p4));

    let p0n = p0 * norm.x;
    let p1n = p1 * norm.y;
    let p2n = p2 * norm.z;
    let p3n = p3 * norm.w;
    let p4n = p4 * norm4;

    let values0 = vec3<f32>(dot(p0n, x0), dot(p1n, x1), dot(p2n, x2));
    let values1 = vec2<f32>(dot(p3n, x3), dot(p4n, x4));

    let m0 = max(vec3<f32>(0.5) - vec3<f32>(dot(x0, x0), dot(x1, x1), dot(x2, x2)), vec3<f32>(0.0));
    let m1 = max(vec2<f32>(0.5) - vec2<f32>(dot(x3, x3), dot(x4, x4)), vec2<f32>(0.0));

    let temp0 = -6.0 * m0 * m0 * values0;
    let temp1 = -6.0 * m1 * m1 * values1;

    let mmm0 = m0 * m0 * m0;
    let mmm1 = m1 * m1 * m1;

    let dx = temp0.x * x0.x + temp0.y * x1.x + temp0.z * x2.x + temp1.x * x3.x + temp1.y * x4.x
        + mmm0.x * p0n.x + mmm0.y * p1n.x + mmm0.z * p2n.x + mmm1.x * p3n.x + mmm1.y * p4n.x;

    let dy = temp0.x * x0.y + temp0.y * x1.y + temp0.z * x2.y + temp1.x * x3.y + temp1.y * x4.y
        + mmm0.x * p0n.y + mmm0.y * p1n.y + mmm0.z * p2n.y + mmm1.x * p3n.y + mmm1.y * p4n.y;

    let dz = temp0.x * x0.z + temp0.y * x1.z + temp0.z * x2.z + temp1.x * x3.z + temp1.y * x4.z
        + mmm0.x * p0n.z + mmm0.y * p1n.z + mmm0.z * p2n.z + mmm1.x * p3n.z + mmm1.y * p4n.z;

    let dw = temp0.x * x0.w + temp0.y * x1.w + temp0.z * x2.w + temp1.x * x3.w + temp1.y * x4.w
        + mmm0.x * p0n.w + mmm0.y * p1n.w + mmm0.z * p2n.w + mmm1.x * p3n.w + mmm1.y * p4n.w;

    return 42.0 * vec4<f32>(dx, dy, dz, dw);
}
fn curl4(p: vec3<f32>, noiseTime: f32, persistence: f32) -> vec3<f32> {
    var xNoisePotentialDerivatives: vec4<f32> = vec4<f32>(0.0);
    var yNoisePotentialDerivatives: vec4<f32> = vec4<f32>(0.0);
    var zNoisePotentialDerivatives: vec4<f32> = vec4<f32>(0.0);

    for (var i: i32 = 0; i < 3; i = i + 1) {
        let twoPowI: f32 = pow(2.0, f32(i));
        let scale: f32 = 0.5 * twoPowI * pow(persistence, f32(i));

        xNoisePotentialDerivatives = xNoisePotentialDerivatives + snoise4(vec4<f32>(p * twoPowI, noiseTime)) * scale;
        yNoisePotentialDerivatives = yNoisePotentialDerivatives + snoise4(vec4<f32>((p + vec3<f32>(123.4, 129845.6, -1239.1)) * twoPowI, noiseTime)) * scale;
        zNoisePotentialDerivatives = zNoisePotentialDerivatives + snoise4(vec4<f32>((p + vec3<f32>(-9519.0, 9051.0, -123.0)) * twoPowI, noiseTime)) * scale;
    }

    return vec3<f32>(
        zNoisePotentialDerivatives.y - yNoisePotentialDerivatives.z,
        xNoisePotentialDerivatives.z - zNoisePotentialDerivatives.x,
        yNoisePotentialDerivatives.x - xNoisePotentialDerivatives.y
    );
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

@binding(0) @group(0) var<uniform> sim_params : SimulationParams;
@binding(1) @group(0) var<storage, read_write> data : Particles;
@binding(2) @group(0) var texture : texture_2d<f32>;

@compute @workgroup_size(64)
fn simulate(@builtin(global_invocation_id) global_invocation_id : vec3u) {
  let idx = global_invocation_id.x;

  init_rand(idx, sim_params.seed);

  var particle = data.particles[idx];

  particle.position = particle.position + sim_params.deltaTime * particle.velocity;
  // Apply gravity
  let noiseCurl = curl4(particle.position * .018, sim_params.snapFrame, 0.5 +  (1.-particle.lifetime) * .21) * .1;
  //let curlBeauti2 = curlNoise((particle.position + particle.velocity) * 1. );
  particle.velocity += noiseCurl * 1.;
  particle.velocity.z -= .3;

  
  particle.lifetime = particle.lifetime - 0.02;

  
  let speed = length(particle.velocity.xyz );
  particle.color = vec4f(speed, speed, speed, 1.0);
  particle.color = vec4f(.5,1.,.5, 1.0);
  particle.color.a = smoothstep(0.0, 0.9, particle.lifetime);
  
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

          mixedColor = mix(color0, color1, randT);
      }

      // Xoay vector nếu cần
      let rotated_xyz = rotX(-3.141592653589793 / 2.0) * mixedColor.xyz;

      particle.position = vec3<f32>(rotated_xyz);

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
