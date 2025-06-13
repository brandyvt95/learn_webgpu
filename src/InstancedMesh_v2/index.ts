import { mat4, Mat4, vec3 } from 'wgpu-matrix';

import {
  cubeVertexArray,
  cubeVertexSize,
  cubeUVOffset,
  cubePositionOffset,
  cubeVertexCount,
  cubeIndices,
  cubeIndexCount,
  cubeVertexArrayOptimized,
  cubeIndicesOptimized,
  cubeVertexCountOptimized,
  cubeVertexOriginArray,

} from '../meshes/cube';

import fkComputeCpu from './compute/fk_on_cpu.wgsl';
import fkComputeGpu from './compute/fk_gpu_depthBase.wgsl';

// import {
//   cubeVertexArray,
//   cubeVertexSize,
//   cubeUVOffset,
//   cubePositionOffset,
//   cubeVertexCount,
//   cubeIndices,
//   // cubeIndexCount,
// } from '../meshes/cubeOri';
import vertWGSL from './vert.wgsl';
import fragWGSL from './frag.wgsl'
import { generateLSystemSegments } from './Lsystem/utils';
import { packSegments } from './Lsystem/packSegments';
import { BoxGeometryDesc } from '../shapes';
import { applyFK, applyForceToSegment, applyStaticFK, buildChains } from './Lsystem/fkCpu';
import { Segment } from './Lsystem/type';
import { mergerBuffer } from './utils';
import { initComputePipeline, type IComputeInitOptions } from './compute/initComputePipeline';

interface InitInstancedMeshOptions {
  device: GPUDevice;
  presentationFormat: GPUTextureFormat;
  frameBindGroupLayout: GPUBindGroupLayout;
  gltf?: any
}

export class InitInstancedMesh {
  device: GPUDevice;
  pipeline: GPURenderPipeline;
  presentationFormat: any
  uniformBindGroup: any
  verticesBuffer: any
  numInstances: any
  frameBindGroupLayout: GPUBindGroupLayout
  modelMatrixBindGroupLayout: GPUBindGroupLayout
  modelMatrixBuffer: any
  modelMatrixBindGroup: GPUBindGroup

  indexBuffer: GPUBuffer
  pointsBuffer: GPUBuffer
  pointsBindGroup: GPUBindGroup

  pointsUpdateBindGroupLayout: GPUBindGroupLayout
  pointsUpdateBindGroup: GPUBindGroup
  pointsBufferUpdate: GPUBuffer

  timeBindGroupLayout: GPUBindGroupLayout
  timeBindGroup: GPUBindGroup
  timeBuffer: GPUBuffer

  branchBindGroupLayout: GPUBindGroupLayout
  branchBindGroup: GPUBindGroup

  segmentsOut: any

  resultBufferSeg: any
  resultMeta: any
  resultBufferSegMeta: any


  computePipeline: any
  compute_branchBindGroupLayout: GPUBindGroupLayout
  compute_branchBindGroup: GPUBindGroup

  infoInstacne_BindGroup: GPUBindGroup
  infoInstacne_Layout: GPUBindGroupLayout
  outputPosIntances: GPUBuffer
  rlsPassComputeBindGroup: GPUBindGroup
  rlsPassComputeBindGroupLayout: GPUBindGroupLayout
  rlsFkBindGroupLayout: GPUBindGroupLayout
  computer_rlsFkBindGroup: GPUBindGroup

  computeFkPipeline:any
  computeFkBGL:GPUBindGroupLayout
  computeFkBG:GPUBindGroup
  constructor({ device, presentationFormat, frameBindGroupLayout }: InitInstancedMeshOptions) {
    this.device = device;
    this.numInstances = 5000
    this.presentationFormat = presentationFormat
    this.frameBindGroupLayout = frameBindGroupLayout

    this.createPipeline();
    this.createBuffersExtra()
    this.createInstanceShape();
    this.createBufferLsystem()

  }

  createPipeline() {
    this.modelMatrixBindGroupLayout = this.device.createBindGroupLayout({
      label: 'group layout model matrix sample',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: 'read-only-storage',
          },
        },
      ],
    });
    this.pointsUpdateBindGroupLayout = this.device.createBindGroupLayout({
      label: 'group layout point update',
      entries: [
        {
          binding: 0, //  array<f32>
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 1, //  array<vec4 < u32>>
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "read-only-storage" },
        }, {
          binding: 2, //  array<u32>
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "read-only-storage" },
        },
      ],
    });
    this.timeBindGroupLayout = this.device.createBindGroupLayout({
      label: 'group layout time param',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" },
      }],
    });
    this.branchBindGroupLayout = this.device.createBindGroupLayout({
      label: 'group layout branch info',
      entries: [
        {
          binding: 0, // segment array<f32>
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 1, // segmentMeta array<vec4 < u32>>
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "read-only-storage" },
        }, {
          binding: 2, // extraMeta array<u32>
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "read-only-storage" },
        },
      ],
    });
    this.rlsPassComputeBindGroupLayout = this.device.createBindGroupLayout({
      label: 'group rls pass cpmpute',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        }
      ],
    });
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [
        this.frameBindGroupLayout,
        this.timeBindGroupLayout,
        this.branchBindGroupLayout,
        this.rlsPassComputeBindGroupLayout/* 
      this.modelMatrixBindGroupLayout */]
    });
    this.pipeline = this.device.createRenderPipeline({

      layout: pipelineLayout,
      vertex: {
        module: this.device.createShaderModule({
          code: vertWGSL,
        }),
        buffers: [
          {
            arrayStride: cubeVertexSize,
            attributes: [
              {
                // position
                shaderLocation: 0,
                offset: cubePositionOffset,
                format: 'float32x4',
              },
              {
                // uv
                shaderLocation: 1,
                offset: cubeUVOffset,
                format: 'float32x2',
              },
            ],
          },
        ],
      },
      fragment: {
        module: this.device.createShaderModule({
          code: fragWGSL,
        }),
        targets: [
          {
            format: this.presentationFormat,
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',           // QUAN TRỌNG: bật face culling
        frontFace: 'ccw',
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
      },
    });
  }
  createInstanceShape() {
    this.verticesBuffer = this.device.createBuffer({
      size: cubeVertexArrayOptimized.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
      mappedAtCreation: true,
    });
    new Float32Array(this.verticesBuffer.getMappedRange()).set(cubeVertexArrayOptimized);
    this.verticesBuffer.unmap();


    if (cubeIndicesOptimized.length > 0) {
      this.indexBuffer = this.device.createBuffer({
        size: cubeIndicesOptimized.byteLength,
        usage: GPUBufferUsage.INDEX,
        mappedAtCreation: true,
      });
      new Uint16Array(this.indexBuffer.getMappedRange()).set(cubeIndicesOptimized);
      this.indexBuffer.unmap();
    }


  }


  createBuffersExtra() {

    const timeBufferSize = 4;

    this.timeBuffer = this.device.createBuffer({
      size: timeBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });


    this.timeBindGroup = this.device.createBindGroup({
      layout: this.timeBindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this.timeBuffer },
      }],
    });
  }
  initLsystem() {
    const config1: any = {
      axiom: "F",
      rules: {
     "F": "F[+F][-F][&F][^F][/F][\\F]",
      "H": "H"
      }
      ,
      iterations: 3,
      angle: 22.5,
      stepSize: 1,
      branchReduction: 0.7,
      randomFactor: 1
    };

    const segments1 = generateLSystemSegments(config1);

    const config2: any = {
      axiom: "F",
      rules: {
        "F": "F[+FH]F[-FH]",
        "H": "H"
      }
      ,
      iterations: 1,
      angle: 22.5,
      stepSize: .2,
      branchReduction: 0.7,
      randomFactor: 1
    };

    const segments2 = generateLSystemSegments(config2);

    const config3: any = {
      axiom: "F",
      rules: {
        "F": "FF+[&F]-[^F]",
        "H": "H"
      }
      ,
      iterations: 2,
      angle: 22.5,
      stepSize: .2,
      branchReduction: 0.7,
      randomFactor: .5
    };

    const segments3 = generateLSystemSegments(config3);

    
    this.segmentsOut = segments1
   
    const { points: point1, meta: segmentMeta1, origin: origin1 } = packSegments(segments1);
    const { points: point2, meta: segmentMeta2, origin: origin2 } = packSegments(segments2);
    const { points: point3, meta: segmentMeta3, origin: origin3 } = packSegments(segments3);
    this.resultBufferSeg = mergerBuffer([point1], 'float32');
    this.resultMeta = mergerBuffer([segmentMeta1], 'uint32');

    const list = [point1]
    // array dynamic , so add key on 0
    // hoặc nhiều hơn
    const categoryBounds = [0];

    for (let i = 0; i < list.length; i++) {
      const last = categoryBounds[categoryBounds.length - 1];
      categoryBounds.push(last + list[i].length);
    }

    //console.log(categoryBounds, resultPoint, resultPoint.length);
    const extrasMeta = new Uint32Array(categoryBounds.length + 1);
    extrasMeta[0] = categoryBounds.length;
    extrasMeta.set(categoryBounds, 1);

    this.resultBufferSegMeta = extrasMeta
    console.log("extrasMeta", extrasMeta)
    // const chain = buildChains(origin1)
    // console.log(chain)

  }
  createBufferLsystem() {
    this.initLsystem()

    this.outputPosIntances = this.device.createBuffer({
      size: this.numInstances * cubeVertexCount * 4 * 4, // 36 vertices, vec4<f32> = 16 bytes
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_SRC,
    });
    this.rlsPassComputeBindGroup = this.device.createBindGroup({
      layout: this.rlsPassComputeBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.outputPosIntances },
        }
      ],
    });
    this.pointsBuffer = this.device.createBuffer
      ({
        size: this.resultBufferSeg.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
    this.device.queue.writeBuffer(this.pointsBuffer, 0, this.resultBufferSeg);

    const segmentMetaBuffer = this.device.createBuffer({
      size: this.resultMeta.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(segmentMetaBuffer, 0, this.resultMeta);

    const extrasMetaBuffer = this.device.createBuffer({
      size: this.resultBufferSegMeta.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(extrasMetaBuffer, 0, this.resultBufferSegMeta);


    this.pointsBufferUpdate = this.device.createBuffer({
      size: this.resultBufferSeg.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.pointsUpdateBindGroup = this.device.createBindGroup({
      layout: this.pointsUpdateBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.pointsBuffer },
        },
        {
          binding: 1,
          resource: { buffer: segmentMetaBuffer },
        }, {
          binding: 2,
          resource: { buffer: extrasMetaBuffer },
        }
      ],
    });
    this.branchBindGroup = this.device.createBindGroup({
      layout: this.branchBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.pointsBuffer },
        },
        {
          binding: 1,
          resource: { buffer: segmentMetaBuffer },
        }, {
          binding: 2,
          resource: { buffer: extrasMetaBuffer },
        }
      ],
    });

    this.initComputeRls({
      buffer: [this.pointsBuffer, segmentMetaBuffer, extrasMetaBuffer]
    })
    this.initComputeFk({
      buffer: [this.pointsBuffer, segmentMetaBuffer, extrasMetaBuffer]
    })
  }
  async initComputeFk({ buffer }: any) {
    console.log(this.segmentsOut,this.segmentsOut.length * 6,this.resultBufferSeg)
    const countDepth = 4
     this.computeFkBGL = this.device.createBindGroupLayout({
      label: 'compute fk group layout  rls',
      entries: [
        {
          binding: 0, // segment array<f32>
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        }
      ],
    });
    this.computeFkBG = this.device.createBindGroup({
      layout: this.computeFkBGL,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.pointsBuffer  },
        }
      ],
    });

    this.computeFkPipeline = await initComputePipeline({
      shader:fkComputeGpu,
      device: this.device,
      layout: [this.infoInstacne_Layout, this.compute_branchBindGroupLayout,this.computeFkBGL]
    });

  }
  async initComputeRls({ buffer }: any) {
    this.rlsFkBindGroupLayout = this.device.createBindGroupLayout({
      label: 'compute group layout fk rls',
      entries: [
        {
          binding: 0, // segment array<f32>
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        }
      ],
    });
    this.computer_rlsFkBindGroup = this.device.createBindGroup({
      layout: this.rlsFkBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.pointsBufferUpdate },
        }
      ],
    });

    this.compute_branchBindGroupLayout = this.device.createBindGroupLayout({
      label: 'compute group layout branch info',
      entries: [
        {
          binding: 0, // segment array<f32>
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 1, // segmentMeta array<vec4 < u32>>
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 2, // extraMeta array<u32>
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        }
      ],
    });
    this.compute_branchBindGroup = this.device.createBindGroup({
      layout: this.compute_branchBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: buffer[0] },
        },
        {
          binding: 1,
          resource: { buffer: buffer[1] },
        },
        {
          binding: 2,
          resource: { buffer: buffer[2] },
        }
      ],
    });


    this.infoInstacne_Layout = this.device.createBindGroupLayout({
      label: 'infoinstacne info',
      entries: [
        {
          binding: 0, // array<f32>
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 1, //  array<f32>
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        }
      ],
    });

    // const vertexCount = cubeVertexArray.length / 10; // Mỗi vertex có 10 floats
    // const cubeVertexOriginArray = new Float32Array(vertexCount * 4); // Chỉ lấy 4 floats đầu

    // for (let i = 0; i < vertexCount; i++) {
    //   cubeVertexOriginArray[i * 4 + 0] = cubeVertexArray[i * 10 + 0]; // x
    //   cubeVertexOriginArray[i * 4 + 1] = cubeVertexArray[i * 10 + 1]; // y
    //   cubeVertexOriginArray[i * 4 + 2] = cubeVertexArray[i * 10 + 2]; // z
    //   cubeVertexOriginArray[i * 4 + 3] = cubeVertexArray[i * 10 + 3]; // w
    // }
    const verticesBufferCompute = this.device.createBuffer({
      size: cubeVertexOriginArray.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
      mappedAtCreation: true,
    });
    new Float32Array(verticesBufferCompute.getMappedRange()).set(cubeVertexOriginArray);
    verticesBufferCompute.unmap();


    this.infoInstacne_BindGroup = this.device.createBindGroup({
      layout: this.infoInstacne_Layout,
      entries: [
        {
          binding: 0,
          resource: { buffer: verticesBufferCompute },
        },
        {
          binding: 1,
          resource: { buffer: this.outputPosIntances },
        }
      ],
    });

    this.computePipeline = await initComputePipeline({
      shader:fkComputeCpu,
      device: this.device,
      layout: [this.infoInstacne_Layout, this.compute_branchBindGroupLayout,this.rlsFkBindGroupLayout]
    });

  }

  runComputePassFk(computePass) {
    if (this.computeFkPipeline) {
      computePass.setPipeline(this.computeFkPipeline);
      computePass.setBindGroup(0, this.infoInstacne_BindGroup);
      computePass.setBindGroup(1, this.compute_branchBindGroup);
      computePass.setBindGroup(2, this.computeFkBG);
      computePass.dispatchWorkgroups(64);
    }
  }
  runComputePass(computePass) {
    if (this.computePipeline) {
      computePass.setPipeline(this.computePipeline);
      computePass.setBindGroup(0, this.infoInstacne_BindGroup);
      computePass.setBindGroup(1, this.compute_branchBindGroup);
      computePass.setBindGroup(2, this.computer_rlsFkBindGroup);
      //cubeVertexCount  : 21
      //this.numInstances 100k
      const totalVertices = this.numInstances * cubeVertexCount;
      //   console.log(totalVertices)
      //computePass.dispatchWorkgroups(Math.ceil( totalVertices/ 64));
      const maxXCompute = 65535;
      const workgroupSize = 64
      const workgroupCountX = Math.min(maxXCompute, Math.ceil(totalVertices / workgroupSize));
      const workgroupCountY = Math.ceil(totalVertices / (workgroupSize * maxXCompute));

      computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY);

    } else {
      console.warn("computePipeline tracking")
    }

  }
  draw({ renderPass, frameBindGroup, timeValue }: { renderPass: GPURenderPassEncoder, frameBindGroup: GPUBindGroup, timeValue: any }) {
    this.device.queue.writeBuffer(
      this.timeBuffer,
      0,
      timeValue.buffer,
      timeValue.byteOffset,
      timeValue.byteLength
    );
    //console.time()

    const animatedSegments = applyFK(this.segmentsOut, timeValue[0]);


    const { points: updatedPoints, meta, origin } = packSegments(animatedSegments as any);
    this.device.queue.writeBuffer(this.pointsBufferUpdate, 0, updatedPoints);
    //console.timeEnd()




    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, frameBindGroup);
    renderPass.setBindGroup(1, this.timeBindGroup);
    renderPass.setBindGroup(2, this.branchBindGroup);
    renderPass.setBindGroup(3, this.rlsPassComputeBindGroup);
    //  renderPass.setBindGroup(4, this.modelMatrixBindGroup);
    renderPass.setVertexBuffer(0, this.verticesBuffer);
    renderPass.setIndexBuffer(this.indexBuffer, "uint16");
    renderPass.drawIndexed(
      cubeIndexCount,
      1 * this.numInstances + 0 * Math.floor(Math.random() * this.numInstances),  // dong toi toi nay de debug frame, tuc la trong so kuong ve moi frame se khac nhau , lieu day co phai dieu chinh xac de ngan render , co toi uu het co chua  
      0,                  // firstIndex
      0,                  // baseVertex
      0                   // firstInstance
    );
  }
}
