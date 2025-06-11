

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


struct CameraUniforms {
  modelMatrix : mat4x4 < f32>,
  viewMatrix : mat4x4 < f32>,
  projectionMatrix : mat4x4 < f32>,
  cameraPosition : vec3 < f32>,
  padding : f32,//<- để giữ alignment 16 bytes
}
struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) fragUV : vec2f,
  @location(1) fragPosition : vec4f,
  @location(2) @interpolate(flat) instanceIdx : u32,
}

@group(0) @binding(0) var<uniform> camera_uniforms : CameraUniforms;
@group(1) @binding(0) var<uniform> uTime : f32;
//@group(2) @binding(0) var<storage, read> points : array<vec3 < f32>>;
@group(2) @binding(0) var<storage, read> SEGMENT_COORD : array<f32>;
@group(2) @binding(1) var<storage, read> segmentMeta : array<vec4 < u32>>;
@group(2) @binding(2) var<storage, read> extraMeta : array<u32>;
@group(3) @binding(0) var<storage, read> outputPassCompute : array<vec4<f32>>;
@vertex
fn main(
@builtin(vertex_index) vertexIdxInInstance : u32,
@builtin(instance_index) instanceIdx : u32,
@location(0) position : vec3 < f32>,
@location(1) uv : vec2f
) -> VertexOutput {
  var output : VertexOutput;

  let extrasLength = extraMeta[0];
  let lengthBuffer_SEGMENT_COORD = extraMeta[extrasLength];
  let maxId = lengthBuffer_SEGMENT_COORD / 6u;
  let loopSize = maxId + 1u;
  let checkId = instanceIdx % loopSize;
  let loopCount = instanceIdx / loopSize;

  let baseIndex = checkId * 6u;


  let A = vec3 < f32 > (
    SEGMENT_COORD[baseIndex + 0u],
    SEGMENT_COORD[baseIndex + 1u],
    SEGMENT_COORD[baseIndex + 2u]
  );

  let B = vec3 < f32 > (
    SEGMENT_COORD[baseIndex + 3u],
    SEGMENT_COORD[baseIndex + 4u],
    SEGMENT_COORD[baseIndex + 5u]
  );
 

  let direction = B - A;
  let segmentLength = length(direction);
  let forward = normalize(direction);

  //✅ Dùng world coordinate system cố định
  //Tìm trục có thành phần nhỏ nhất trong forward
  let absForward = abs(forward);
  var right = vec3(0.0);

  if (absForward.x <= absForward.y && absForward.x <= absForward.z)
  {
      //X component nhỏ nhất
    right = vec3(1.0, 0.0, 0.0);
  } else if (absForward.y <= absForward.z)
  {
      //Y component nhỏ nhất
    right = vec3(0.0, 1.0, 0.0);
  } else {
      //Z component nhỏ nhất
    right = vec3(0.0, 0.0, 1.0);
  }

  //Gram-Schmidt
  right = normalize(right - dot(right, forward) * forward);
  let actualUp = cross(forward, right);



  //Mỗi depth sẽ được __string__0__endstring__ sau 2 giây
  let delayPerDepth = .01;

  //Thời gian kéo dài của mỗi instance (ví dụ 0.5s hoặc tùy bạn)
  let durationPerInstance = 0.5;

  //Thời gian bắt đầu của instance này = depth * delay
  let startTime = f32(instanceIdx) * delayPerDepth;

  //Thời gian kết thúc
  let endTime = startTime + durationPerInstance;

  //Tiến trình kéo dài (progress: 0..1)
  let progress = clamp((uTime - startTime) / durationPerInstance, 0.0, 1.0);

  //Độ dài hiện tại của instance
  var currentLength = mix(0.0, segmentLength, progress);
  currentLength = segmentLength;
  var sss = segmentMeta[checkId].y;
  var factor = 1.;
  if(sss > 1u){
    factor = .3;
  }
  let scaledPos = vec3 < f32 > (
  position.x * factor * .02,        //thickness cố định
  position.y * currentLength * 0.5,         //length từ 0 đến segmentLength/2
  position.z * factor * .02         //thickness cố định
  );

    //✅ QUAN TRỌNG: Center luôn cách A một khoảng currentLength/2
    //Cube sẽ bắt đầu tại A, mở rộng về phía B
  let center = A + forward * (currentLength * 0.5);

    //Transform cube position
  var worldPos = center +
  right * scaledPos.x +
  forward * scaledPos.y +
  actualUp * scaledPos.z;


  var clusterCoord = vec3f(0., 0., 0.);

  for (var i = 1u; i < extrasLength; i = i + 1u)
  {
    if (baseIndex >= extraMeta[i] && baseIndex < extraMeta[i + 1u])
    {
      let seed = loopCount * 73856093u + i * 19349663u; //Sử dụng 2 số nguyên tố lớn
      let randX = randomFromSeed(seed);
      let randZ = randomFromSeed(seed + 1u);//Đổi seed một chút để không giống nhau
      
      clusterCoord.x += randX * 5.0;
      clusterCoord.z += randZ * 5.0;
      break;
    }
  }


  worldPos.x += clusterCoord.x;
  worldPos.z += clusterCoord.z;

  let baseIndex2 = instanceIdx * 24u + vertexIdxInInstance;
let posCompute = outputPassCompute[baseIndex2];
  
let rlsPos = vec4<f32>( posCompute.xyz * 1., 1.0);
  output.Position = camera_uniforms.projectionMatrix *
  camera_uniforms.viewMatrix *
  camera_uniforms.modelMatrix *
  //vec4 < f32 > (worldPos * .1, 1.0);
  rlsPos;

  output.fragUV = uv;
  output.fragPosition = rlsPos * 10.;
  output.instanceIdx = checkId;
  return output;
}
