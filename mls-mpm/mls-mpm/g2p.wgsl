struct Particle {
    position: vec3f, 
    v: vec3f, 
    C: mat3x3f, 
}
struct Cell {
    vx: i32, 
    vy: i32, 
    vz: i32, 
    mass: i32, 
}

override fixed_point_multiplier: f32; 
override dt: f32; 

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<storage, read> cells: array<Cell>;
@group(0) @binding(2) var<uniform> real_box_size: vec3f;
@group(0) @binding(3) var<uniform> init_box_size: vec3f;
@group(0) @binding(4) var<uniform> numParticles: u32;
@group(0) @binding(5) var<uniform> timeCount: f32;
@group(0) @binding(6) var sdfTex: texture_2d<f32>;

fn decodeFixedPoint(fixed_point: i32) -> f32 {
	return f32(fixed_point) / fixed_point_multiplier;
}
// Hàm tạo ma trận xoay quanh trục Y
fn rotateY(angle: f32) -> mat3x3<f32> {
    let c = cos(angle);
    let s = sin(angle);
    return mat3x3<f32>(
        vec3<f32>(c, 0.0, s),
        vec3<f32>(0.0, 1.0, 0.0),
        vec3<f32>(-s, 0.0, c)
    );
}
// Hàm tạo ma trận xoay quanh trục X
fn rotateX(angle: f32) -> mat3x3<f32> {
    let c = cos(angle);
    let s = sin(angle);
    return mat3x3<f32>(
        vec3<f32>(1.0, 0.0, 0.0),
        vec3<f32>(0.0, c, -s),
        vec3<f32>(0.0, s, c)
    );
}


fn sdSphereShrinkSurface(p: vec3<f32>, r: f32, time: f32) -> f32 {
    let d = length(p);
    let distortion = 0.1 * sin(10.0 * p.x + time) * sin(10.0 * p.y + time) * sin(10.0 * p.z + time);
    return d - (r + distortion);
}
fn sdTorus(p: vec3<f32>, t: vec2<f32>) -> f32 {
    let q = vec2<f32>(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}
fn sdBox(p: vec3<f32>, b: vec3<f32>) -> f32 {
    let q = abs(p) - b;
    return length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}
fn smin(a: f32, b: f32, k: f32) -> f32 {
    let h = max(k - abs(a - b), 0.0);
    return min(a, b) - h * h * 0.25 / k;
}
fn sdBoxWobbly(p: vec3<f32>, b: vec3<f32>, t: f32) -> f32 {
    // Rotate box nếu cần
    let angle = t * 0.6;
    let rotatedP1 = rotateY(-angle) * p;
     let rotatedP2 = rotateX(angle) * p;
    // Tính khoảng cách chuẩn tới box
    let q = abs(rotatedP1) - b;
   
    let torusc = vec2<f32>(1.0, 0.1)  * real_box_size.x * .1;
       let q1 = rotatedP2;
    let baseDist1 = length(vec2<f32>(length(q1.xz + vec2f(30.,0.)) - torusc.x, q1.y)) - torusc.y;
    let baseDist2 = length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);

    // Làm nhấp nhô mặt bằng sin
    let freq = 800.0;
    let amp = 0.2;
    let wobble = amp * sin(freq * rotatedP1.x + t)
                      * sin(freq * rotatedP1.y + t)
                      * sin(freq * rotatedP1.z + t);
     let blended = smin(baseDist1,baseDist2,.1);
    return blended + wobble * 0.;
}
fn sdRotatingBoxSimple(p: vec3<f32>, b: vec3<f32>, dt: f32) -> f32 {
   return sdBoxWobbly(p, b, 0.);
}
fn sampleSDF(
    sdfTex: texture_2d<f32>,
    pos: vec3<f32>,
    real_box_size: vec3<f32>, // [64, 64, 64]
    sliceSize: vec2<i32>,     // [64, 64] 
    numSlicesXY: vec2<i32>,   // [16, 4]
    timeCount: f32
) -> vec4<f32> {
    // THÊM: Tính frame indices và interpolation factor
    let frameFloat = timeCount % 62.0;
    let frame1 = i32(floor(frameFloat));
    let frame2 = (frame1 + 1) % 62;
    let t = fract(frameFloat); // interpolation factor (0.0 - 1.0)
    
       // Ví dụ offset theo trục Y
let offset = vec3<f32>(0.0, 8., 0.0); // dịch xuống 50% chiều cao

let normalizedPos = (pos + offset) / real_box_size;

    // Bước 2: Chuyển đổi sang không gian voxel grid (SDF có resolution 64x64x64)
    let sdfResolution = vec3<f32>(64.0, 64.0, 64.0);
    let voxelPos = normalizedPos * (sdfResolution - 1.0);
    
    // Bước 3: Tính toán slice index và vị trí trong slice
    let z = i32(clamp(voxelPos.z, 0.0, 63.0));
    let sliceY = z / numSlicesXY.x;  // slice row
    let sliceX = z % numSlicesXY.x;  // slice column
    
    // Bước 4: Tính toán tọa độ pixel cuối cùng cho cả 2 frames
    let sliceOffsetX = sliceX * sliceSize.x;
    let sliceOffsetY = sliceY * sliceSize.y;
    
    let pixelX = sliceOffsetX + i32(clamp(voxelPos.x, 0.0, 63.0));
    
    // Sample từ frame 1
    let frame1OffsetY = frame1 * 256;
    let pixelY1 = frame1OffsetY + sliceOffsetY + i32(clamp(voxelPos.y, 0.0, 63.0));
    let sample1 = textureLoad(sdfTex, vec2<i32>(pixelX, pixelY1), 0);
    
    // Sample từ frame 2
    let frame2OffsetY = frame2 * 256;
    let pixelY2 = frame2OffsetY + sliceOffsetY + i32(clamp(voxelPos.y, 0.0, 63.0));
    let sample2 = textureLoad(sdfTex, vec2<i32>(pixelX, pixelY2), 0);
    
    // Bước 5: Interpolate giữa 2 frames
    return mix(sample1, sample2, t);
}
fn getSDFForce(
    position: vec3<f32>,
    sdfTex: texture_2d<f32>,
    real_box_size: vec3<f32>,
      dirCenter : vec3<f32>,
      timeCount: f32
) -> vec3<f32> {
    
    // Sample SDF
    let sdf = sampleSDF(
        sdfTex, 
        position, 
        real_box_size,
        vec2<i32>(64, 64),
        vec2<i32>(16, 4),
        timeCount
    );
    
    let gradient = normalize(sdf.rgb * 2. - 1.);    // Gradient vector
    let distance = sdf.a * 2. - 1.;      // SDF distance
    let forceStrength = .2;

        let stepCheck = -0.8;
        let innerThreshold =  stepCheck + 0.1;  // Giảm xuống 0.05
        let outerThreshold = stepCheck;
    let forceCen = -dirCenter * 0.1;

    let falloff = smoothstep(-0.5, 0.0, distance); // từ sâu trong đến sát bề mặt

    let rangeHold = .1;
    let offClamp = 1.;
    if (sdf.a < rangeHold) {
        
        if(sdf.a < rangeHold && sdf.a > 0.05){
            let td = (sdf.a - 0.04) / (rangeHold - 0.04); // map sdf.a từ [0.04, rangeHold] -> [0.0, 1.0]
            let clampVelGrad = clamp(td, 0.1, .2);
            return -vec3f(gradient) * clampVelGrad * 4.; 
        }else{
            //  if(position.y > 50.) {
            //      return vec3f(0. ,-.5,0.);
            //  }else{
                
            //  }
            return vec3f(0. ,0.,0.);
        }
    }else{
        if(position.y < 3.4) {
            
             return vec3f(forceCen) * 1. + vec3f(0.) * 0.;
        }else{
             return vec3f(forceCen) * 0. + vec3f(0. ,-.1,0.) * 2.;
        }
     
    }
 
}

@compute @workgroup_size(64)
fn g2p(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x < numParticles) {
        particles[id.x].v = vec3f(0.);
        var weights: array<vec3f, 3>;

        let particle = particles[id.x];
        let cell_idx: vec3f = floor(particle.position);
        let cell_diff: vec3f = particle.position - (cell_idx + 0.5f);
        weights[0] = 0.5f * (0.5f - cell_diff) * (0.5f - cell_diff);
        weights[1] = 0.75f - cell_diff * cell_diff;
        weights[2] = 0.5f * (0.5f + cell_diff) * (0.5f + cell_diff);

        var B: mat3x3f = mat3x3f(vec3f(0.), vec3f(0.), vec3f(0.));
        for (var gx = 0; gx < 3; gx++) {
            for (var gy = 0; gy < 3; gy++) {
                for (var gz = 0; gz < 3; gz++) {
                    let weight: f32 = weights[gx].x * weights[gy].y * weights[gz].z;
                    let cell_x: vec3f = vec3f(
                        cell_idx.x + f32(gx) - 1., 
                        cell_idx.y + f32(gy) - 1.,
                        cell_idx.z + f32(gz) - 1.  
                    );
                    let cell_dist: vec3f = (cell_x + 0.5f) - particle.position;
                    let cell_index: i32 = 
                        i32(cell_x.x) * i32(init_box_size.y) * i32(init_box_size.z) + 
                        i32(cell_x.y) * i32(init_box_size.z) + 
                        i32(cell_x.z);
                    let weighted_velocity: vec3f = vec3f(
                        decodeFixedPoint(cells[cell_index].vx), 
                        decodeFixedPoint(cells[cell_index].vy), 
                        decodeFixedPoint(cells[cell_index].vz)
                    ) * weight;
                    let term: mat3x3f = mat3x3f(
                        weighted_velocity * cell_dist.x, 
                        weighted_velocity * cell_dist.y, 
                        weighted_velocity * cell_dist.z
                    );

                    B += term ;

                    particles[id.x].v += weighted_velocity * 1.;
                }
            }
        }

        particles[id.x].C = B * 4.0f;
        particles[id.x].position += particles[id.x].v * dt;
        particles[id.x].position = vec3f(
            clamp(particles[id.x].position.x, 1., real_box_size.x - 2.), 
            clamp(particles[id.x].position.y, 1., real_box_size.y - 2.), 
            clamp(particles[id.x].position.z, 1., real_box_size.z - 2.)
        );
        // particles[id.x].v += vec3f(0.,grciti,0.);   
        let center = vec3f(real_box_size.x / 2, real_box_size.y / 2, real_box_size.z / 2);
        //  let dist = center - particles[id.x].position ;
         let dist = particles[id.x].position - center;
        let dirToOrigin = normalize(dist);
        var rForce = vec3f(0);

        let r = .2; 

        if (dot(dist, dist) < r * r) {
           // particles[id.x].v -= -(r - sqrt(dot(dist, dist))) * dirToOrigin * 3.0;
        }
      
          //  particles[id.x].v -= dirToOrigin *dt  * 0.04;
   
        let sdfForce = getSDFForce(particle.position, sdfTex, real_box_size,dirToOrigin,timeCount);
    
        particles[id.x].v += sdfForce  * 1.;
      
       // particles[id.x].v.y -= 0.1;

        let boxParams = vec3<f32>(real_box_size.x * .2);
        //  let torusParams = vec2<f32>(2.0, 0.5)  * real_box_size.x * 0.5;
        //  let distanceSphere = sdSphereShrinkSurface(dist , .2,timeCount);
        let distanceBox = sdRotatingBoxSimple(dist , boxParams,timeCount);
        //  let distanceTorus = sdTorus(dist, torusParams);

       // let distance  = distanceBox;
       // let params_shape = boxParams;
       // let epsilon = 0.1;
        //let gradient = vec3<f32>(
        //    sdRotatingBoxSimple(dist + vec3<f32>(epsilon, 0.0, 0.0), params_shape,timeCount) - distance,
        //    sdRotatingBoxSimple(dist + vec3<f32>(0.0, epsilon, 0.0), params_shape,timeCount) - distance,
        //    sdRotatingBoxSimple(dist + vec3<f32>(0.0, 0.0, epsilon), params_shape,timeCount) - distance
        //) / epsilon;
         //if (distance < 0.) { // clamp vel step
         //  particles[id.x].v += -distance * normalize(gradient) * 4.0 ;
        //}else{
          // particles[id.x].v += -normalize(gradient) * 0.1;
        //}
     



      
        let k = 3.;
        let wall_stiffness = 1.0;
        let x_n: vec3f = particles[id.x].position + particles[id.x].v * dt * k;
        let wall_min: vec3f = vec3f(3.);
        let wall_max: vec3f = real_box_size - 4.;
        if (x_n.x < wall_min.x) { particles[id.x].v.x += wall_stiffness * (wall_min.x - x_n.x); }
        if (x_n.x > wall_max.x) { particles[id.x].v.x += wall_stiffness * (wall_max.x - x_n.x); }
        if (x_n.y < wall_min.y) { particles[id.x].v.y += wall_stiffness * (wall_min.y - x_n.y); }
        if (x_n.y > wall_max.y) { particles[id.x].v.y += wall_stiffness * (wall_max.y - x_n.y); }
        if (x_n.z < wall_min.z) { particles[id.x].v.z += wall_stiffness * (wall_min.z - x_n.z); }
        if (x_n.z > wall_max.z) { particles[id.x].v.z += wall_stiffness * (wall_max.z - x_n.z); }
    }
}