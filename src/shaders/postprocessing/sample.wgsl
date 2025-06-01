// ground.wgsl (ví dụ)
@vertex
fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4<f32> {
  var bound = 1.;
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-bound, -bound),
    vec2<f32>(bound, -bound),
    vec2<f32>(-bound, bound),
    vec2<f32>(-bound, bound),
    vec2<f32>(bound, -bound),
    vec2<f32>(bound, bound)
  );
  return vec4<f32>(pos[vertexIndex], 0.0, 1.);
}
@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> viewportSize: vec2<f32>;

fn getUVOffset(offset: vec2<f32>) -> vec2<f32> {
    return offset / viewportSize;
}

@fragment

fn fs_main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
    let uv = coord.xy / viewportSize;
    var colorSum = vec4<f32>(0.0);
    let offsets = array<vec2<f32>, 9>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(0.0, -1.0), vec2<f32>(1.0, -1.0),
        vec2<f32>(-1.0,  0.0), vec2<f32>(0.0,  0.0), vec2<f32>(1.0,  0.0),
        vec2<f32>(-1.0,  1.0), vec2<f32>(0.0,  1.0), vec2<f32>(1.0,  1.0)
    );

    for (var i = 0u; i < 9u; i = i + 1u) {
        let sampleUV = uv + offsets[i] / viewportSize;
        colorSum = colorSum + textureSample(inputTexture, inputSampler, sampleUV);
    }

    // blurStrength = 1.0 => blur bình thường (chia cho 9)
    // blurStrength > 1.0 => nhoè mạnh hơn (chia ít hơn, màu sáng hơn)
    // blurStrength < 1.0 => nhoè yếu hơn (chia nhiều hơn, màu tối hơn)
    let blurStrength = 2.;
    let divisor = 9.0 / blurStrength;
    let blurredColor = colorSum / divisor;

    return blurredColor;
}