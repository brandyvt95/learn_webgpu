
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
