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

@fragment
fn fs_main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
    let uv = coord.xy / viewportSize;
    return textureSample(inputTexture, inputSampler, uv);
}

