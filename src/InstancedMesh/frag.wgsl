@group(3) @binding(1) var<storage, read> segmentMeta : array<vec4<u32>>;

@fragment
fn main(
@location(0) fragUV : vec2 < f32>,
@location(1) fragPosition : vec4 < f32>,
@location(2) @interpolate(flat) instanceIdx : u32,
) -> @location(0) vec4 < f32> {
  let metac = segmentMeta[instanceIdx];
  let parentId = f32(metac.x);
  let depth = f32(metac.y) / 2.;
  let isBranchStart = f32(metac.z);

  var color : vec3 < f32>;
  color = vec3 < f32 > (isBranchStart, 0.0, 0.0);

  return vec4 < f32 > (vec3f(depth), 1.0);
}
