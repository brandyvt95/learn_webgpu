

  //Hàm tạo ma trận xoay quanh axis góc angle (theo trục)
fn rotationMatrix(axis : vec3 < f32>, angle : f32) -> mat3x3 < f32> {
  let c = cos(angle);
  let s = sin(angle);
  let t = 1.0 - c;

  return mat3x3 < f32 > (
  vec3 < f32 > (t * axis.x * axis.x + c, t * axis.x * axis.y - s * axis.z, t * axis.x * axis.z + s * axis.y),
  vec3 < f32 > (t * axis.x * axis.y + s * axis.z, t * axis.y * axis.y + c, t * axis.y * axis.z - s * axis.x),
  vec3 < f32 > (t * axis.x * axis.z - s * axis.y, t * axis.y * axis.z + s * axis.x, t * axis.z * axis.z + c)
  );
}
fn randomFromSeed(seed : u32) -> f32 {
  var hashed = seed;
  hashed ^= (hashed >> 17);
  hashed *= 0xed5ad4bbu;
  hashed ^= (hashed >> 11);
  hashed *= 0xac4c1b51u;
  hashed ^= (hashed >> 15);
  hashed *= 0x31848babu;
  let normalized = f32(hashed & 0x00FFFFFFu) / f32(0x01000000u);//[0.0, 1.0)
  return normalized * 2.0 - 1.0;//[-1.0, 1.0)
}



@group(0) @binding(0) var<storage, read> vertexPositions  : array<vec3<f32>>;
@group(0) @binding(1) var<storage, read_write> outputPositions  : array<vec4<f32>>;
@group(1) @binding(0) var<storage, read> SEGMENT_COORD : array<f32>;
@group(1) @binding(1) var<storage, read> segmentMeta : array<vec4 < u32>>;
@group(1) @binding(2) var<storage, read> extraMeta : array<u32>;
@group(2) @binding(0) var<storage, read> SEGMENT_COORD_FK : array<f32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>)
{
  let extrasLength = extraMeta[0];
  let lengthBuffer_SEGMENT_COORD = extraMeta[extrasLength];
  let maxId = lengthBuffer_SEGMENT_COORD / 6u;
  let loopSize = maxId + 1u;
  let checkId = (lengthBuffer_SEGMENT_COORD / 2u) % loopSize;
  let metac = segmentMeta[checkId];
  let parentId = f32(metac.x);
  let depth = f32(metac.y) / 3.;
  let isBranchStart = f32(metac.z);

  outputPositions[global_id.x] = vec4f( 0.,0.,0., 1.0);
}
