@group(0) @binding(0) var<storage, read> vertexPositions  : array<vec3<f32>>;
@group(0) @binding(1) var<storage, read_write> outputPositions  : array<vec4<f32>>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id : vec3 < u32>)
{
   let vertexGlobalIndex = global_id.x;

  let vertexPerInstance = 24u;
  let instanceIdx = vertexGlobalIndex / vertexPerInstance;
  let vertexIdxInInstance = vertexGlobalIndex % vertexPerInstance;

  let vertex = vertexPositions[vertexIdxInInstance];
  let gridWidth = 10u;
  let x = f32(vertexGlobalIndex % gridWidth);
  let y = f32(vertexGlobalIndex / gridWidth);
  let offsetSample = vec3f(x * .1, y * .1, 0.0);
  outputPositions[vertexGlobalIndex] = vec4f(offsetSample ,1.);
}
