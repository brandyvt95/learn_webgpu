@group(3) @binding(1) var<storage, read> segmentMeta: array<u32>;

@fragment
fn main(
  @location(0) fragUV: vec2<f32>,
  @location(1) fragPosition: vec4<f32>,
  @location(2) @interpolate(flat) instanceIdx: u32,
) -> @location(0) vec4<f32> {
  let baseIndex = instanceIdx * 4u;

  var targetd = vec3<u32>(
    segmentMeta[baseIndex + 0u],
    segmentMeta[baseIndex + 1u],
    segmentMeta[baseIndex + 2u]
  );

  var m = targetd.z;

var m_f = f32(m);
var clr = vec4<f32>(m_f,m_f, m_f, 1.0);


  // if (m == 0u) {
  //     clr = vec4<f32>(1.0, 0.0, 0.0, 1.0); // đỏ
  // } else if (m == 1u) {
  //     clr = vec4<f32>(0.0, 1.0, 0.0, 1.0); // xanh lá
  // } else if (m == 2u) {
  //     clr = vec4<f32>(0.0, 0.0, 1.0, 1.0); // xanh dương
  // } else if (m == 3u) {
  //     clr = vec4<f32>(1.0, 0.0, 1.0, 1.0); // tím
  // } else {
  //     clr = vec4<f32>(0.1, 0.5, 0.7, 1.0); // mặc định
  // }

  return clr;
}
