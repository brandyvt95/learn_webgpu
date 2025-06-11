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
  cubeVertexCountOptimized
} from '../meshes/cube';
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
import { initComputePipeline,type IComputeInitOptions } from '../COMPUTE/initComputePipeline';

interface InitInstancedMeshOptions {
  device: GPUDevice;
  presentationFormat: GPUTextureFormat;
  frameBindGroupLayout: GPUBindGroupLayout;
  gltf: any
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

  gltf: any
  segmentsOut: any

  resultBufferSeg:any
  resultMeta:any
  resultBufferSegMeta:any


  computePipeline:any

  constructor({ device, presentationFormat, frameBindGroupLayout, gltf }: InitInstancedMeshOptions) {
    this.device = device;
    this.gltf = gltf
    this.numInstances = 20000
    this.presentationFormat = presentationFormat
    this.frameBindGroupLayout = frameBindGroupLayout

    this.createPipeline();
    this.createBuffersExtra()
    this.createInstanceShape();
    this.createBufferLsystem()
    this.createBuffersMatrixRand()
    this.initCompute()
  }

  createPipeline() {
    this.modelMatrixBindGroupLayout = this.device.createBindGroupLayout({
      label:'group layout model matrix sample',
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
      label:'group layout point update',
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
      label:'group layout time param',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" },
      }],
    });
    this.branchBindGroupLayout = this.device.createBindGroupLayout({
      label:'group layout branch info',
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

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [
        this.frameBindGroupLayout,
        this.timeBindGroupLayout,
        this.branchBindGroupLayout,
        this.pointsUpdateBindGroupLayout/* 
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
      usage: GPUBufferUsage.VERTEX,
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



  createBuffersMatrixRand() {

    const matrixSize = 64; // bytes
    const bufferSize = matrixSize * this.numInstances;

    this.modelMatrixBuffer = this.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.modelMatrixBindGroup = this.device.createBindGroup({
      layout: this.modelMatrixBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.modelMatrixBuffer,
          },
        },
      ],
    });
    // Tạo array để chứa dữ liệu
    const modelMatrices = new Float32Array(16 * this.numInstances);

    for (let i = 0; i < this.numInstances; i++) {
      const offset = i * 16;
      const tx = (Math.random() - 0.5) * 205; // translate x
      const ty = (Math.random() - 0.5) * 205; // translate y
      const tz = (Math.random() - 0.5) * 205; // translate z

      // Ghi ma trận model đơn giản: identity + translate
      const scale = 0.05;
      modelMatrices.set([
        scale, 0, 0, 0,
        0, scale, 0, 0,
        0, 0, scale, 0,
        tx, ty, tz, 1,
      ], offset);
    }

    // Ghi vào GPU buffer
    this.device.queue.writeBuffer(
      this.modelMatrixBuffer,
      0, // offset
      modelMatrices.buffer,
      modelMatrices.byteOffset,
      modelMatrices.byteLength
    );
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
        "F": "FF+[+&F]-[-^F+F]",

        "H": "H"
      }
      ,
      iterations: 3,
      angle: 22.5,
      stepSize: .2,
      branchReduction: 0.7,
      randomFactor: 1
    };

    const segments1 = generateLSystemSegments(config1);

   const config2: any = {
      axiom: "F",
      rules: {
        "F": "F+[-&F]-[^F]",
        "H": "H"
      }
      ,
      iterations: 3,
      angle: 22.5,
      stepSize: .2,
      branchReduction: 0.7,
      randomFactor: 1
    };

    const segments2 = generateLSystemSegments(config2);

     const config3: any = {
      axiom: "F",
      rules: {
        "F": "FF+[&F&F&F]-[^F]",
        "H": "H"
      }
      ,
      iterations: 2,
      angle: 22.5,
      stepSize: .2,
      branchReduction: 0.7,
      randomFactor: 1
    };

    const segments3 = generateLSystemSegments(config3);


    this.segmentsOut = segments2
    const { points: point1, meta: segmentMeta1, origin: origin1 } = packSegments(segments1);
    const { points: point2, meta: segmentMeta2, origin: origin2 } = packSegments(segments2);
    const { points: point3, meta: segmentMeta3, origin: origin3 } = packSegments(segments3);
    this.resultBufferSeg = mergerBuffer([point1,point2,point3], 'float32');
    this.resultMeta =  mergerBuffer([segmentMeta1,segmentMeta2,segmentMeta3], 'uint32');

    const list =  [point1,point2,point3]
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
  }

  async initCompute() {
    this.computePipeline = await  initComputePipeline({
      device:this.device,
      bindGroupList:[this.branchBindGroup]
    });
    console.log(   this.computePipeline )
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

    // const animatedSegments = applyFK(this.segmentsOut, timeValue[0]);


    // const { points: updatedPoints, meta, origin } = packSegments(animatedSegments as any);
    // this.device.queue.writeBuffer(this.pointsBufferUpdate, 0, updatedPoints);
    // console.timeEnd()


    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, frameBindGroup);
    renderPass.setBindGroup(1, this.timeBindGroup);
    renderPass.setBindGroup(2, this.branchBindGroup);
    renderPass.setBindGroup(3, this.pointsUpdateBindGroup);
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
