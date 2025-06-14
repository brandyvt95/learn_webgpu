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
   return sdBoxWobbly(p, b, dt);
}
fn sampleSDF(
    sdfTex: texture_2d<f32>,
    pos: vec3<f32>,
    real_box_size: vec3<f32>,
    sliceSize: vec2<i32>,
    numSlicesXY: vec2<i32>,
    scale: f32
) -> vec4<f32> {
    
    let center = real_box_size * 0.5;
    let scaledPos = (pos - center) * scale + center;
    
    // Normalize về [0,1]
    let normalized = scaledPos / real_box_size;
    
    if (any(normalized < vec3<f32>(0.0)) || any(normalized > vec3<f32>(1.0))) {
        return vec4<f32>(1.0, 0.0, 0.0, 1.0);
    }
    
    // Scale đến SDF resolution (128x128x128)
    let sdfResolution = vec3<f32>(128.0, 128.0, 128.0);
    let voxelPos = normalized * sdfResolution;
    
    // Downsample: lấy mỗi pixel thứ 2 (128->64 effective resolution)
    let downsampleFactor = 2.0;
    let sampledVoxelPos = voxelPos / downsampleFactor;
    
    let voxelI = vec3<i32>(sampledVoxelPos);
    
    // Clamp với resolution đã downsample
    let maxIndex = vec3<i32>(i32(128.0 / downsampleFactor) - 1); // 63
    let x = clamp(voxelI.x, 0, maxIndex.x);
    let y = clamp(voxelI.y, 0, maxIndex.y);
    let z = clamp(voxelI.z, 0, maxIndex.z);
    
    // Scale lại lên để index đúng trong texture 128x128
    let actualX = x * i32(downsampleFactor);
    let actualY = y * i32(downsampleFactor);
    let actualZ = z * i32(downsampleFactor);
    
    // Tính slice coordinate
    let sliceCoord = vec2<i32>(
        actualZ % numSlicesXY.x,
        actualZ / numSlicesXY.x
    );
    
    let texCoord = vec2<i32>(
        sliceCoord.x * sliceSize.x + actualX,
        sliceCoord.y * sliceSize.y + actualY
    );
    
    return textureLoad(sdfTex, texCoord, 0);
}
fn getSDFForce(
    position: vec3<f32>,
    sdfTex: texture_2d<f32>,
    real_box_size: vec3<f32>,
      scale: f32  
) -> vec3<f32> {
    
    // Sample SDF
    let sdf = sampleSDF(
        sdfTex, 
        position, 
        real_box_size,
        vec2<i32>(128, 128),
        vec2<i32>(16, 8),
        scale
    );
    
    let gradient = normalize(sdf.rgb);    // Gradient vector
    let distance = sdf.a;      // SDF distance
    
    // Nếu ở trong object (distance < 0) -> đẩy ra
   if (distance > 0.5) {
    let forceStrength = 0.2;
    return -gradient * forceStrength * distance;  // Bỏ abs() để lực mạnh hơn khi xa
} else if (distance < 0.3) {  // Thêm điều kiện này
    let forceStrength = 0.2;
    return gradient * forceStrength * (0.3 - distance);  // Đẩy ra khi quá gần
} else {
    return vec3<f32>(0.0);  // Vùng an toàn 0.3 - 0.5
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

                    B += term;

                    particles[id.x].v += weighted_velocity * .99995;
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

        let center = vec3f(real_box_size.x / 2, real_box_size.y / 2, real_box_size.z / 2);
         //  let dist = center - particles[id.x].position ;
        let dist = particles[id.x].position - center;
        let dirToOrigin = normalize(dist);
        var rForce = vec3f(0);

        let r = 1.; 

        if (dot(dist, dist) < r * r) {
        // particles[id.x].v += -(r - sqrt(dot(dist, dist))) * dirToOrigin * 3.0;
        }

        // particles[id.x].v += (dirToOrigin * 0.3) ;


        //real_box_size.xyz = 72,72,72
        //particles[id.x].position chinh la vi tri hat

        let sliceSizeX = 128;
        let sliceSizeY = 128;
        let totalSliceOnXSdf = 16;
        let totalSliceonYSdf = 8;
        let sdfForce = getSDFForce(particle.position, sdfTex, real_box_size,.7);
    

     particles[id.x].v += sdfForce + timeCount * 0.;
    
    //    let boxParams = vec3<f32>(real_box_size.x * .2);
    //    let torusParams = vec2<f32>(2.0, 0.5)  * real_box_size.x * 0.5;

    //     let distanceSphere = sdSphereShrinkSurface(dist , .2,timeCount);

    //    let distanceBox = sdRotatingBoxSimple(dist , boxParams,timeCount);
    //  let distanceTorus = sdTorus(dist, torusParams);

        
    //     let distance  = distanceBox;
    //     let params_shape = boxParams;
    //     let epsilon = 0.1;
       
        // let gradient = vec3<f32>(
        //     sdRotatingBoxSimple(dist + vec3<f32>(epsilon, 0.0, 0.0), params_shape,timeCount) - distance,
        //     sdRotatingBoxSimple(dist + vec3<f32>(0.0, epsilon, 0.0), params_shape,timeCount) - distance,
        //     sdRotatingBoxSimple(dist + vec3<f32>(0.0, 0.0, epsilon), params_shape,timeCount) - distance
        // ) / epsilon;
        // if (distance < 0.) { // clamp vel step
        //   // particles[id.x].v += -distance * normalize(gradient) * 4.0 ;
        // }else{
        //  //particles[id.x].v += -normalize(gradient) * 0.1;
        // }
     




















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