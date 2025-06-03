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


  geometry: any
  skin: any

  constructor({ device, presentationFormat, scene, COMMON_PIPLINE_STATE_DESC, gltf }: ModelSkin2Options) {
    this.device = device;
    this.gltf = gltf;
    this.scene = scene
    this.COMMON_PIPLINE_STATE_DESC = COMMON_PIPLINE_STATE_DESC
    this.checkInfo();
    this.createMesh();
    this.createUniform();
    this.createPipeline(presentationFormat);

    this.checkInfoAnim()

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
     const skinBindGroupLayout = this.device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' }
      }]
    });
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout, cameraBindGroupLayout,skinBindGroupLayout],
    });

    // Mô tả vertex buffers theo attrName (ví dụ POSITION và NORMAL)
    // Bạn phải điều chỉnh cho đúng attr và format trong glTF (ví dụ vec3 float32)
    const vertexBuffers: GPUVertexBufferLayout[] = [
      {
        arrayStride: 12, // 3 * 4 bytes (float32 vec3)
        attributes: [
          {
            shaderLocation: 0,
            format: "float32x3",
            offset: 0,
          },
        ],
        stepMode: "vertex",
      },
      {
        arrayStride: 12,
        attributes: [
          {
            shaderLocation: 1,
            format: "float32x3",
            offset: 0,
          },
        ],
        stepMode: "vertex",
      },
    ];
const vertexBuffers2: GPUVertexBufferLayout[] = [
  // POSITION
  {
    arrayStride: 12,
    attributes: [{ shaderLocation: 0, format: "float32x3", offset: 0 }],
  },
  // NORMAL
  {
    arrayStride: 12,
    attributes: [{ shaderLocation: 1, format: "float32x3", offset: 0 }],
  },
  // UV
  {
    arrayStride: 8,
    attributes: [{ shaderLocation: 2, format: "float32x2", offset: 0 }],
  },
  // Tangent
  {
    arrayStride: 16,
    attributes: [{ shaderLocation: 3, format: "float32x4", offset: 0 }],
  },
];

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
  checkInfoAnim() {

    function getAccessorTypedArray(accessor: any, gltf: any): ArrayBufferView {
      const bufferView = gltf.bufferViews[accessor.bufferView];
      const byteArray = bufferView.byteArray;

      // TODO: Does this need to take into account non-tightly packed buffers?

      const typedArrayOffset = bufferView.byteOffset + accessor.byteOffset;
      const elementCount = accessor.extras.componentCount * accessor.count;
      const arrayType = getComponentTypeArrayConstructor(accessor.componentType);
      return new arrayType(byteArray.buffer, typedArrayOffset, elementCount);
    }
    const animations = [];
    if (this.gltf.animations) {
      for (const animation of (this.gltf.animations as any[])) {

        const channels: AnimationChannel[] = [];
        for (const channel of animation.channels) {
          const channelSampler = animation.samplers[channel.sampler];

          let samplerType: any;
          switch (channelSampler.interpolation) {
            case 'STEP': samplerType = StepAnimationSampler; break;
            case 'CUBICSPLINE ': // TODO
            case 'LINEAR': {
              if (channel.target.path == 'rotation') {
                samplerType = SphericalLinearAnimationSampler; break;
              } else {
                samplerType = LinearAnimationSampler; break;
              }
            }
            default: throw new Error(`Unknown channel interpolation type: ${channelSampler.interpolation}`);
          }

          const inputAccessor = this.gltf.accessors[channelSampler.input];
          const outputAccessor = this.gltf.accessors[channelSampler.output];

          const sampler = new samplerType(
            getAccessorTypedArray(inputAccessor, this.gltf),
            getAccessorTypedArray(outputAccessor, this.gltf),
            outputAccessor.extras.componentCount
          );
          channels.push(new AnimationChannel(channel.target.node, channel.target.path, sampler));
        }

        animations.push(new Animation(animation.name || `Animation_${animations.length}`, channels));
      }
      console.log(animations)
    }




    const sceneNodes = [];

    // Two passes over the nodes. First to construct the node objects.
    for (const node of (this.gltf.nodes as any[])) {
      let transform: any;
      if (node.matrix) {
        transform = new MatrixTransform(node.matrix);
      } else if (node.translation || node.rotation || node.scale) {
        transform = new Transform({
          translation: node.translation,
          rotation: node.rotation,
          scale: node.scale
        });
      }

      if (node.mesh !== undefined) {
        sceneNodes.push(new Mesh({
          transform,
          geometry: null,
        }));
      } else {

        sceneNodes.push(new SceneObject({
          transform
        }));
      }
    }
    console.log("sceneNodes on gltf.ts", sceneNodes)
    const animationTarget = new AnimationTarget(sceneNodes);


  }



  skinGeometry(renderPass: GPURenderPassEncoder, geometry: RenderGeometry, skin: RenderSkin): any {
    this.geometry = geometry
    this.skin = skin
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
    renderPass.setVertexBuffer(1, this.geometry.vertexBuffers[2].buffer);
    renderPass.setVertexBuffer(2, this.geometry.vertexBuffers[2].buffer);
    renderPass.setVertexBuffer(3, this.geometry.vertexBuffers[3].buffer);
    renderPass.setVertexBuffer(4, this.geometry.vertexBuffers[4].buffer);
    renderPass.setVertexBuffer(5, this.geometry.vertexBuffers[5].buffer);

    renderPass.setIndexBuffer(this.indexBuffer, "uint16");
    renderPass.drawIndexed(this.indexCount);
  }
}
