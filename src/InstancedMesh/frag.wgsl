@fragment
fn main(
  @location(0) fragUV: vec2f,
  @location(1) fragPosition: vec4f
) -> @location(0) vec4f {
  return vec4f(fragUV,fragPosition.x,1.);
}