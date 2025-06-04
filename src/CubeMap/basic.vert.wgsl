struct Uniforms {
  modelViewProjectionMatrix : mat4x4f,
}
struct CameraUniforms {
  modelMatrix : mat4x4<f32>,
  viewMatrix : mat4x4<f32>,
  projectionMatrix : mat4x4<f32>,
  cameraPosition : vec3<f32>,
  padding : f32, // <- để giữ alignment 16 bytes
}
@group(0) @binding(0) var<uniform> camera_uniforms: CameraUniforms;
@group(1) @binding(0) var<uniform> uniforms : Uniforms;

struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) fragUV : vec2f,
  @location(1) fragPosition: vec4f,
}

@vertex
fn main(
  @location(0) position : vec4f,
  @location(1) uv : vec2f
) -> VertexOutput {
  var output : VertexOutput;
  output.Position =camera_uniforms.projectionMatrix * camera_uniforms.viewMatrix  *  camera_uniforms.modelMatrix * position;
  output.fragUV = uv;
  output.fragPosition = 0.5 * (position + vec4(1.0, 1.0, 1.0, 1.0));
  return output;
}



// import { cameraStruct } from "../shaders/common.js";
// const SKYBOX_SHADER = /*wgsl*/ `
//   ${cameraStruct}
//   @group(0) @binding(0) var<uniform> camera : Camera;

//   struct VertexOutput {
//     @builtin(position) position : vec4f,
//     @location(0) texcoord : vec3f,
//   };

//   @vertex
//   fn vertexMain(@location(0) position : vec4f) -> VertexOutput {
//     var output : VertexOutput;

//     var modelView = camera.view;
//     // Drop the translation portion of the modelView matrix
//     modelView[3] = vec4(0, 0, 0, modelView[3].w);
//     output.position = camera.projection * modelView * position;
//     // Returning the W component for both Z and W forces the geometry depth to
//     // the far plane. When combined with a depth func of "less-equal" this makes
//     // the sky write to any depth fragment that has not been written to yet.
//     output.position = vec4f(output.position.xyw, output.position.w + 0.0001);
//     // Should be this, but adding the epsilon to work around an Android bug
//     //output.position = output.position.xyww;
//     output.texcoord = position.xyz;

//     return output;
//   }

//   @group(0) @binding(2) var environmentSampler : sampler;
//   @group(0) @binding(3) var environmentTexture : texture_cube<f32>;

//   @fragment
//   fn fragmentMain(@location(0) texcoord : vec3f) -> @location(0) vec4f {
//     return textureSample(environmentTexture, environmentSampler, texcoord);
//     //return textureSampleLevel(environmentTexture, environmentSampler, texcoord, 1);
//   }
// `;