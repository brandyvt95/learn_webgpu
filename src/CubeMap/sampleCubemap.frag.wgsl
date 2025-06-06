  @group(0) @binding(2) var environmentSampler : sampler;
  @group(0) @binding(3) var environmentTexture : texture_cube<f32>;
@fragment
fn main(
  @location(0) fragUV: vec2f,
  @location(1) fragPosition: vec4f
) -> @location(0) vec4f {
  // Our camera and the skybox cube are both centered at (0, 0, 0)
  // so we can use the cube geometry position to get viewing vector to sample
  // the cube texture. The magnitude of the vector doesn't matter.
  var cubemapVec = fragPosition.xyz - vec3(0.5);
  // When viewed from the inside, cubemaps are left-handed (z away from viewer),
  // but common camera matrix convention results in a right-handed world space
  // (z toward viewer), so we have to flip it.
  cubemapVec.z *= -1;
  let oo = textureSample(environmentTexture, environmentSampler, cubemapVec);
  return vec4f(vec3f(1.,.2,.4),.4) ;
}
