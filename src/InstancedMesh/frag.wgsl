@group(3) @binding(1) var<storage, read> segmentMeta: array<f32>;

@fragment
fn main(
  @location(0) fragUV: vec2<f32>,
  @location(1) fragPosition: vec4<f32>,
  @location(2) @interpolate(flat) instanceIdx: u32,
) -> @location(0) vec4<f32> {
  let baseIndex = instanceIdx * 4u;

let parentId     = segmentMeta[baseIndex + 0u];
let depth  = segmentMeta[baseIndex + 1u];
let isBranchStart = segmentMeta[baseIndex + 2u];

var color: vec3<f32>;
color = vec3<f32>(depth/6., 0.0, 0.0); 

return vec4<f32>(vec3f(fragUV,0.), 1.0);
}
