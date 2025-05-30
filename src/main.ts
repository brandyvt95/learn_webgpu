import { mat4, vec3 } from 'wgpu-matrix';
import { GUI } from 'dat.gui';

import particleWGSL from './shaders/particle.wgsl';
import probabilityMapWGSL from './shaders/probabilityMap.wgsl';
import { quitIfWebGPUNotAvailable } from './util';
import { createInputHandler } from './intractive';
import { initCamera } from './camera/index';
import { createTextureFromPNGWithoutMipmaps, cropBinToWebGPUTexture } from './loadTexture';

import DATA_DETAIL_VAT from '../img/fast_run.json'
import { Ground } from './ground';




const CONFIG_VAT = {
  width: 23243,
  height: 63
}

async function main() {
  const numParticles = 345000;
  const particlePositionOffset = 0;
  const particleColorOffset = 4 * 4;
  const particleInstanceByteSize =
    3 * 4 + // position
    1 * 4 + // lifetime
    4 * 4 + // color
    3 * 4 + // velocity
    1 * 4 + // padding
    0;



  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  const adapter = await navigator.gpu?.requestAdapter({
    featureLevel: 'compatibility',
  });
  const device = await adapter?.requestDevice();
  quitIfWebGPUNotAvailable(adapter, device);

  const context = canvas.getContext('webgpu') as GPUCanvasContext;

  const devicePixelRatio = window.devicePixelRatio;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  const presentationFormat = 'rgba16float';



  const response2 = await fetch('../img/fast_run_vat.bin')
  const binBuffer = await response2.arrayBuffer()


  // 3. Các nhóm cột bạn muốn crop
  const columnGroups = [
    DATA_DETAIL_VAT.backFaceVAT,
    DATA_DETAIL_VAT.footLeftVAT,
    DATA_DETAIL_VAT.footRightVAT
  ]

  // 4. Gọi hàm
  const result = await cropBinToWebGPUTexture(device, binBuffer, CONFIG_VAT.width, CONFIG_VAT.height, columnGroups)
  const infoTexVATDetail = result.texture;




  const { getModelViewProjectionMatrix } = initCamera(window, canvas)
  const aspect = canvas.width / canvas.height;

  function configureContext() {
    context.configure({
      device,
      format: presentationFormat,
      toneMapping: { mode: simulationParams.toneMappingMode },
    });
  }



  const particlesBuffer = device.createBuffer({
    size: numParticles * particleInstanceByteSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
  });

  const renderPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: device.createShaderModule({
        code: particleWGSL,
      }),
      buffers: [
        {
          // instanced particles buffer
          arrayStride: particleInstanceByteSize,
          stepMode: 'instance',
          attributes: [
            {
              // position
              shaderLocation: 0,
              offset: particlePositionOffset,
              format: 'float32x3',
            },
            {
              // color
              shaderLocation: 1,
              offset: particleColorOffset,
              format: 'float32x4',
            },
          ],
        },
        {
          // quad vertex buffer
          arrayStride: 2 * 4, // vec2f
          stepMode: 'vertex',
          attributes: [
            {
              // vertex positions
              shaderLocation: 2,
              offset: 0,
              format: 'float32x2',
            },
          ],
        },
      ],
    },
    fragment: {
      module: device.createShaderModule({
        code: particleWGSL,
      }),
      targets: [
        {
          format: presentationFormat,
          blend: {
            color: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
          }

        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
    },

    depthStencil: {
      depthWriteEnabled: false,
      depthCompare: 'always',
      format: 'depth24plus',
    },
  });

  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const uniformBufferSize =
    4 * 4 * 4 + // modelViewProjectionMatrix : mat4x4f
    3 * 4 + // right : vec3f
    4 + // padding
    3 * 4 + // up : vec3f
    4 + // padding
    0;
  const uniformBuffer_PARTICLE = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformBindGroup_PARTICLE = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer_PARTICLE,
        },
      },
    ],
  });

  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      {
        view: undefined, // Assigned later
        clearValue: [0, 0, 0, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
    depthStencilAttachment: {
      view: depthTexture.createView(),

      depthClearValue: 1.0,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',

    },
  };

  //////////////////////////////////////////////////////////////////////////////
  // Quad vertex buffer
  //////////////////////////////////////////////////////////////////////////////
  const quadVertexBuffer = device.createBuffer({
    size: 6 * 2 * 4, // 6x vec2f
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  // prettier-ignore
  const vertexData = [
    -1.0, -1.0, +1.0, -1.0, -1.0, +1.0, -1.0, +1.0, +1.0, -1.0, +1.0, +1.0,
  ];
  new Float32Array(quadVertexBuffer.getMappedRange()).set(vertexData);
  quadVertexBuffer.unmap();

  //////////////////////////////////////////////////////////////////////////////
  // Texture
  //////////////////////////////////////////////////////////////////////////////
  // const isPowerOf2 = (v: number) => Math.log2(v) % 1 === 0;
  // const response = await fetch('../img/cat.jpg');
  // const imageBitmap = await createImageBitmap(await response.blob());
  // assert(imageBitmap.width === imageBitmap.height, 'image must be square');
  // assert(isPowerOf2(imageBitmap.width), 'image must be a power of 2');

  // const mipLevelCount =
  //   (Math.log2(Math.max(imageBitmap.width, imageBitmap.height)) + 1) | 0;
  // const texture = device.createTexture({
  //   size: [imageBitmap.width, imageBitmap.height, 1],
  //   mipLevelCount: 1,
  //   format: 'rgba8unorm',
  //   usage:
  //     GPUTextureUsage.TEXTURE_BINDING |
  //     GPUTextureUsage.STORAGE_BINDING |
  //     GPUTextureUsage.COPY_DST |
  //     GPUTextureUsage.RENDER_ATTACHMENT,
  // });
  // device.queue.copyExternalImageToTexture(
  //   { source: imageBitmap },
  //   { texture: texture },
  //   [imageBitmap.width, imageBitmap.height]
  // );
  // const pngTexture = await createTextureFromPNGWithoutMipmaps(device, '../img/Tony_VAT.png');


  // console.log(texture)

  //////////////////////////////////////////////////////////////////////////////
  // Simulation compute pipeline
  //////////////////////////////////////////////////////////////////////////////
  const simulationParams = {
    simulate: true,
    deltaTime: 0.04,
    toneMappingMode: 'standard' as GPUCanvasToneMappingMode,
    brightnessFactor: 1.0,
    snapFrame: 0
  };

  const simulationUBOBufferSize =
    1 * 4 + // deltaTime
    1 * 4 + // brightnessFactor
    2 * 4 + // padding
    4 * 4 + // seed
    0;
  const simulationUBOBuffer = device.createBuffer({
    size: simulationUBOBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const gui = new GUI();
  gui.width = 325;
  gui.add(simulationParams, 'simulate');
  gui.add(simulationParams, 'deltaTime');

  const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: device.createShaderModule({
        code: particleWGSL,
      }),
      entryPoint: 'simulate',
    },
  });
  const computeBindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: simulationUBOBuffer,
        },
      },
      {
        binding: 1,
        resource: {
          buffer: particlesBuffer,
          offset: 0,
          size: numParticles * particleInstanceByteSize,
        },
      },
      {
        binding: 2,
        resource: infoTexVATDetail.createView(),
      },
    ],
  });


  const ground = new Ground(device);
  ground.createPipeline()
  ground.creatUniform()



  let coutnFrame = 0
  function frame() {
    const time = performance.now() / 1000;
    coutnFrame += simulationParams.deltaTime * 40
    if (coutnFrame > CONFIG_VAT.height) {
      coutnFrame = 0
    }
    device.queue.writeBuffer(
      simulationUBOBuffer,
      0,
      new Float32Array([
        simulationParams.simulate ? simulationParams.deltaTime * .1 : 0.0,
        coutnFrame,
        0.0,
        0.0, // padding
        Math.random() * 100,
        Math.random() * 100, // seed.xy
        1 + Math.random(),
        1 + Math.random(), // seed.zw
      ])
    );

    const { modelViewProjectionMatrix, viewMatrix } = getModelViewProjectionMatrix(simulationParams.deltaTime);

    // Ghi trực tiếp modelViewProjectionMatrix vào uniform
    device.queue.writeBuffer(
      uniformBuffer_PARTICLE,
      0,
      new Float32Array([
        // modelViewProjectionMatrix
        modelViewProjectionMatrix[0], modelViewProjectionMatrix[1], modelViewProjectionMatrix[2], modelViewProjectionMatrix[3],
        modelViewProjectionMatrix[4], modelViewProjectionMatrix[5], modelViewProjectionMatrix[6], modelViewProjectionMatrix[7],
        modelViewProjectionMatrix[8], modelViewProjectionMatrix[9], modelViewProjectionMatrix[10], modelViewProjectionMatrix[11],
        modelViewProjectionMatrix[12], modelViewProjectionMatrix[13], modelViewProjectionMatrix[14], modelViewProjectionMatrix[15],

        // right vector
        viewMatrix[0], viewMatrix[4], viewMatrix[8],

        0, // padding

        // up vector
        viewMatrix[1], viewMatrix[5], viewMatrix[9],

        0, // padding
      ])
    );

    device.queue.writeBuffer(
      ground.uniformBuffer_GROUND,
      0,
      new Float32Array([
        // modelViewProjectionMatrix
        modelViewProjectionMatrix[0], modelViewProjectionMatrix[1], modelViewProjectionMatrix[2], modelViewProjectionMatrix[3],
        modelViewProjectionMatrix[4], modelViewProjectionMatrix[5], modelViewProjectionMatrix[6], modelViewProjectionMatrix[7],
        modelViewProjectionMatrix[8], modelViewProjectionMatrix[9], modelViewProjectionMatrix[10], modelViewProjectionMatrix[11],
        modelViewProjectionMatrix[12], modelViewProjectionMatrix[13], modelViewProjectionMatrix[14], modelViewProjectionMatrix[15],

        // right vector
        viewMatrix[0], viewMatrix[4], viewMatrix[8],

        0, // padding

        // up vector
        viewMatrix[1], viewMatrix[5], viewMatrix[9],

        0, // padding
      ])
    );

    const swapChainTexture = context.getCurrentTexture();
    // prettier-ignore
    renderPassDescriptor.colorAttachments[0].view = swapChainTexture.createView();

    const commandEncoder = device.createCommandEncoder();

    // Compute pass
    {
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      computePass.dispatchWorkgroups(Math.ceil(numParticles / 64));
      computePass.end();
    }

    // Render pass (gộp draw particle + ground vào đây)
    {
      const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);

      // Vẽ ground
      ground.draw(renderPass);

      // Vẽ particle
      renderPass.setPipeline(renderPipeline);
      renderPass.setBindGroup(0, uniformBindGroup_PARTICLE);
      renderPass.setVertexBuffer(0, particlesBuffer);
      renderPass.setVertexBuffer(1, quadVertexBuffer);
      renderPass.draw(6, numParticles, 0, 0);



      renderPass.end();
    }

    device.queue.submit([commandEncoder.finish()]);


    requestAnimationFrame(frame);
  }
  configureContext();
  requestAnimationFrame(frame);

  function assert(cond: boolean, msg = '') {
    if (!cond) {
      throw new Error(msg);
    }
  }


}

main(); 