import { getAccessorData } from "./helper";
import vertWGSL from './shader/vert.wgsl';
import fragWGSL from './shader/frag.wgsl';
import { Mesh } from '../scene/mesh.js';
import { SceneObject, AbstractTransform, MatrixTransform, Transform } from '../scene/object.js';
import { Animation, AnimationChannel, AnimationSampler, AnimationTarget, LinearAnimationSampler, SphericalLinearAnimationSampler, StepAnimationSampler } from '../animation/animation.js';
import { AttributeLocation, GeometryDescriptor, RenderGeometry } from "../geometry/geometry.js";
import { RenderSkin } from "../geometry/skin.js";
import { GeometryLayout } from "../geometry/geometry-layout.js";

interface ModelSkin2Options {
  device: GPUDevice;
  presentationFormat: GPUTextureFormat;
  cameraBGCluster: any;
  gltf: any;
  COMMON_PIPLINE_STATE_DESC: any
  scene: any
  skinBindGroup:any
  skinBindGroupLayout:any
}
const GL = WebGLRenderingContext;

function getComponentTypeArrayConstructor(componentType: GLenum) {
  switch (componentType) {
    case GL.BYTE: return Int8Array;
    case GL.UNSIGNED_BYTE: return Uint8Array;
    case GL.SHORT: return Int16Array;
    case GL.UNSIGNED_SHORT: return Uint16Array;
    case GL.UNSIGNED_INT: return Uint32Array;
    case GL.FLOAT: return Float32Array;
    default: throw new Error(`Unexpected componentType: ${componentType}`);
  }
}
interface SkinnedGeometry {
  geometry: RenderGeometry;
  pipeline: GPUComputePipeline;
  bindGroup: GPUBindGroup;
}
function getSkinningShader(layout: Readonly<GeometryLayout>) {
  const is16BitJoints = layout.getLocationDesc(AttributeLocation.joints).format === 'uint16x4';
  console.log("is16BitJoints", is16BitJoints, layout.locationsUsed.has(AttributeLocation.normal))
  return `
  struct SkinnedVertexOutputs {
    position: vec4f,
#if ${layout.locationsUsed.has(AttributeLocation.normal)}
    normal: vec4f,
#endif
#if ${layout.locationsUsed.has(AttributeLocation.tangent)}
    tangent: vec4f,
#endif
  };
  @group(0) @binding(0) var<storage, read_write> outVerts : array<SkinnedVertexOutputs>;

  // TODO: These should come from a uniform
  override jointStride: u32 = 1;
  override weightStride: u32 = 4;
  override positionStride: u32 = 3;
  override normalStride: u32 = 3;
  override tangentStride: u32 = 4;

  struct OffsetValues {
    vertexCount: u32,
    joint: u32,
    weight: u32,
    position: u32,
    normal: u32,
    tangent: u32
  };

  @group(0) @binding(1) var<uniform> offsets: OffsetValues;

  @group(0) @binding(2) var<storage> inJoints: array<u32>;
  @group(0) @binding(3) var<storage> inWeights: array<f32>;
  @group(0) @binding(4) var<storage> inPosition: array<f32>;
#if ${layout.locationsUsed.has(AttributeLocation.normal)}
  @group(0) @binding(5) var<storage> inNormal: array<f32>;
#endif
#if ${layout.locationsUsed.has(AttributeLocation.tangent)}
  @group(0) @binding(6) var<storage> inTangent: array<f32>;
#endif
  

  ${skinningFunctions}
  @group(1) @binding(0) var<storage> invBindMat: array<mat4x4f>;
  @group(1) @binding(1) var<storage> jointMat: array<mat4x4f>;

  @compute @workgroup_size(64)
  fn computeMain(@builtin(global_invocation_id) globalId : vec3u) {
    let i = globalId.x;
    if (i >= offsets.vertexCount) { return; }

#if ${is16BitJoints}
    let packedJoints0 = inJoints[i * jointStride + offsets.joint];
    let joint0 = (packedJoints0 & 0xFFFF);
    let joint1 = (packedJoints0 & 0xFFFF0000) >> 16;
    let packedJoints1 = inJoints[i * jointStride + offsets.joint + 1];
    let joint2 = (packedJoints1 & 0xFFFF);
    let joint3 = (packedJoints1 & 0xFFFF0000) >> 16;
#else
    let packedJoints = inJoints[i * jointStride + offsets.joint];
    let joint0 = (packedJoints & 0xFF);
    let joint1 = (packedJoints & 0xFF00) >> 8;
    let joint2 = (packedJoints & 0xFF0000) >> 16;
    let joint3 = (packedJoints & 0xFF000000) >> 24;
#endif
    let joints = vec4u(joint0, joint1, joint2, joint3);

    let wo = i * weightStride + offsets.weight;
    let weights = vec4f(inWeights[wo], inWeights[wo + 1], inWeights[wo + 2], inWeights[wo + 3]);

    let skinMatrix = getSkinMatrix(joints, weights);

    let po = i * positionStride + offsets.position;
    let pos = vec4f(inPosition[po], inPosition[po + 1], inPosition[po + 2], 1);
    outVerts[i].position = vec4f((skinMatrix * pos).xyz, 1);

#if ${layout.locationsUsed.has(AttributeLocation.normal)}
    let no = i * normalStride + offsets.normal;
    let normal = vec4f(inNormal[no], inNormal[no + 1], inNormal[no + 2], 0);
    outVerts[i].normal = vec4f(normalize((skinMatrix * normal).xyz), 0);
#endif

#if ${layout.locationsUsed.has(AttributeLocation.tangent)}
    let to = i * tangentStride + offsets.tangent;
    let tangent = vec4f(inTangent[to], inTangent[to + 1], inTangent[to + 2], inTangent[to + 3]);
    outVerts[i].tangent = vec4(normalize((skinMatrix * vec4f(tangent.xyz, 1)).xyz), tangent.w);
#endif
  }
`;
}
export class InitModelSkin2 {
  device: GPUDevice;
  gltf: any;
  pipeline: GPURenderPipeline;

  vertexBuffers: Map<string, GPUBuffer> = new Map();
  indexBuffer: GPUBuffer | null = null;
  indexCount = 0;

  uniformBuffer: GPUBuffer | null = null;
  uniformBindGroup: GPUBindGroup | null = null;

  jointBuffer: GPUBuffer | null = null;
  jointArray: Float32Array;
  jointBindGroup: GPUBindGroup | null = null;
  joints: Number[]
  scene: any
  COMMON_PIPLINE_STATE_DESC: any

  #skinnedGeometry: WeakMap<RenderGeometry, SkinnedGeometry> = new WeakMap();
  #skinningPipelines: Map<number, GPUComputePipeline> = new Map();
  skinBindGroupLayout: any
skinBindGroup:any

  geometry: any
  skin: any

  constructor({ device, presentationFormat, scene, COMMON_PIPLINE_STATE_DESC, gltf,skinBindGroup,skinBindGroupLayout }: ModelSkin2Options) {
    this.device = device;
    this.gltf = gltf;
    this.scene = scene
    this.skinBindGroup = skinBindGroup
    this.skinBindGroupLayout = skinBindGroupLayout
    this.COMMON_PIPLINE_STATE_DESC = COMMON_PIPLINE_STATE_DESC
    this.checkInfo();
    this.createMesh();
    this.createUniform();
    this.createPipeline(presentationFormat);

  }

  checkInfo() {
    console.log("GLTF Info:", this.gltf);
    // Có thể thêm log chi tiết ở đây nếu cần
  }

  createMesh() {
    this.joints = this.gltf.skins[0].joints
    const accessors = this.gltf.accessors;
    const bufferViews = this.gltf.bufferViews;
    const primitives = this.gltf.meshes[0].primitives[0];
    const attributes = primitives.attributes;

    // Tạo GPUBuffer cho từng attribute
    for (const attrName in attributes) {
      const accessorIndex = attributes[attrName];
      const accessor = accessors[accessorIndex];
      const bufferViewIndex = accessor.bufferView;
      const bufferView = bufferViews[bufferViewIndex];

      // Nếu đã có GPUBuffer trong bufferView.extras.gpu.buffer thì dùng luôn
      let gpuBuffer: GPUBuffer;
      if (bufferView.extras && bufferView.extras.gpu && bufferView.extras.gpu.buffer) {
        gpuBuffer = bufferView.extras.gpu.buffer;
      }
      this.vertexBuffers.set(attrName, gpuBuffer);
    }

    // Tạo index buffer
    if (primitives.indices !== undefined) {
      const indexAccessor = accessors[primitives.indices];
      const bufferView = bufferViews[indexAccessor.bufferView];

      let gpuBuffer: GPUBuffer;
      if (bufferView.extras && bufferView.extras.gpu && bufferView.extras.gpu.buffer) {
        gpuBuffer = bufferView.extras.gpu.buffer;
      }

      this.indexBuffer = gpuBuffer;
      this.indexCount = indexAccessor.count;
    } else {
      this.indexBuffer = null;
      this.indexCount = 0;
    }
  }



  createUniform() {
    // Tạo uniform buffer đơn giản 64 bytes (ví dụ chứa matrix 4x4)
    this.uniformBuffer = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Tạo bind group layout + bind group cho uniform (nếu cần)
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" },
      }],
    });

    this.uniformBindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{
        binding: 0,
        resource: {
          buffer: this.uniformBuffer,
        },
      }],
    });
  }

  createPipeline(presentationFormat: GPUTextureFormat) {

    const shaderModuleVert = this.device.createShaderModule({ code: vertWGSL });
    const shaderModuleFrag = this.device.createShaderModule({ code: fragWGSL });

    // Bind group layout cho uniform
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" },
      }],
    });
    const cameraBindGroupLayout = this.device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' }
      }]
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout, cameraBindGroupLayout,this.skinBindGroupLayout],
    });

  
const vertexBuffers2: GPUVertexBufferLayout[] = [
  // POSITION - location 0
  {
    arrayStride: 12, // 3 floats * 4 bytes
    attributes: [{ shaderLocation: 0, format: "float32x3", offset: 0 }],
  },
  // NORMAL - location 1  
  {
    arrayStride: 12, // 3 floats * 4 bytes
    attributes: [{ shaderLocation: 1, format: "float32x3", offset: 0 }],
  },
  // TEXCOORD - location 2
  {
    arrayStride: 8, // 2 floats * 4 bytes
    attributes: [{ shaderLocation: 2, format: "float32x2", offset: 0 }],
  },
  // JOINTS - location 3 (THAY ĐỔI: không phải tangent nữa)
  {
    arrayStride: 16, // 4 values * 4 bytes
    attributes: [{ 
      shaderLocation: 3, 
      format: "uint32x4", // hoặc "float32x4" nếu joints là float
      offset: 0 
    }],
  },
  // WEIGHTS - location 4 (THÊM MỚI)
  {
    arrayStride: 16, // 4 floats * 4 bytes
    attributes: [{ 
      shaderLocation: 4, 
      format: "float32x4", 
      offset: 0 
    }],
  },
  {
    arrayStride: 16, // 1 floats * 4 bytes
    attributes: [{ 
      shaderLocation: 5, 
      format: "float32x4", 
      offset: 0 
    }],
  }
];
const jointArray = new Uint32Array([222,221,220,219,153,152,151,149,148,146,144,142,59,58,57,56,55,52,43,38,33,24,23,22,9,2,3,8,7,6,5,4,10,11,12,13,14,15,16,17,18,19,20,21,25,26,27,28,29,30,31,32,34,35,36,37,39,40,41,42,44,45,46,47,48,49,50,51,53,54,100,99,97,92,91,62,61,60,65,64,63,68,67,66,76,71,70,69,75,74,73,72,84,79,78,77,83,82,81,80,90,87,86,85,89,88,96,94,93,95,98,141,140,138,133,132,103,102,101,106,105,104,109,108,107,117,112,111,110,116,115,114,113,125,120,119,118,124,123,122,121,131,128,127,126,130,129,137,135,134,136,139,143,145,147,150,218,165,164,163,162,160,155,154,157,156,159,158,161,177,176,175,174,172,167,166,169,168,171,170,173,214,212,210,209,208,207,206,205,204,203,202,201,198,196,194,192,191,190,189,188,187,186,185,184,183,182,181,180,179,178,193,195,197,199,200,211,213,215,216,217]);

this.jointBuffer = this.device.createBuffer({
  size: jointArray.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  mappedAtCreation: true,
});
new Uint32Array(this.jointBuffer.getMappedRange()).set(jointArray);
this.jointBuffer.unmap();

    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModuleVert,
        entryPoint: "main",
        buffers: vertexBuffers2,
      },
      fragment: {
        module: shaderModuleFrag,
        entryPoint: "main",
        targets: [{ format: presentationFormat }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },

      ...this.COMMON_PIPLINE_STATE_DESC
    });
  }

  updateUniformBuffer(matrixData: Float32Array) {
    // Cập nhật uniform buffer với matrix transform mới
    this.device.queue.writeBuffer(this.uniformBuffer!, 0, matrixData.buffer);
  }
 


  skinGeometry(renderPass: GPURenderPassEncoder, geometry: RenderGeometry, skin: RenderSkin): any {
    this.geometry = geometry
    
    if(!this.skin) {
      this.skin = skin
    }
  // Debug vertex buffers
  // console.log('Vertex buffers:', geometry.vertexBuffers);
  // geometry.vertexBuffers.forEach((vb, index) => {
  //   console.log(`Buffer ${index}:`, vb);
  // });
  }


  draw({ renderPass, uniform }: { renderPass: GPURenderPassEncoder; uniform: any }) {
    renderPass.setPipeline(this.pipeline);

    renderPass.setBindGroup(0, this.uniformBindGroup!);
    if (uniform.length == 0) return
    for (let i = 0; i < uniform.length; i++) {
      renderPass.setBindGroup(i + 1, uniform[i]);
    }
    
   renderPass.setBindGroup(2, this.skin.bindGroup);
    // Set vertex buffers theo thứ tự location trong shader
    // Ở ví dụ này giả sử:
    // location 0 = POSITION
    // location 1 = NORMAL
    
    renderPass.setVertexBuffer(0, this.geometry.vertexBuffers[0].buffer);
    renderPass.setVertexBuffer(1, this.geometry.vertexBuffers[5].buffer);
    renderPass.setVertexBuffer(2, this.geometry.vertexBuffers[2].buffer);
    renderPass.setVertexBuffer(3, this.geometry.vertexBuffers[3].buffer);
    renderPass.setVertexBuffer(4, this.geometry.vertexBuffers[3].buffer);
    renderPass.setVertexBuffer(5, this.geometry.vertexBuffers[5].buffer);

   renderPass.setVertexBuffer(6, this.jointBuffer);

    renderPass.setIndexBuffer(this.geometry.indexBuffer.buffer, "uint16");
    renderPass.drawIndexed(this.geometry.drawCount);
  }
}
