import { Mat4, Vec3 } from '../lib_strager/gl-matrix/dist/esm/index.js';

import { SceneObject, AbstractTransform, MatrixTransform, Transform } from '../scene/object.js';
import { Mesh } from '../scene/mesh.js';
import { Animation, AnimationChannel, AnimationSampler, AnimationTarget, LinearAnimationSampler, SphericalLinearAnimationSampler, StepAnimationSampler } from '../animation/animation.js';

import { WebGpuGltfLoader } from '../third-party/hoard-gpu/dist/gltf/webgpu-gltf-loader.js'
import { WebGpuTextureLoader } from '../third-party/hoard-gpu/dist/texture/webgpu/webgpu-texture-loader.js'
import { ComputeAABB } from '../third-party/hoard-gpu/dist/gltf/transforms/compute-aabb.js'
import { RenderSkin, SkinDescriptor } from '../geometry/skin.js';
import { GeometryDescriptor } from '../geometry/geometry.js';
import { RenderGeometryManager } from '../renderer/render-geometry.js';
const GL = WebGLRenderingContext;

function gpuFormatForAccessor(accessor: any): GPUVertexFormat {
  const norm = accessor.normalized ? 'norm' : 'int';
  const count = accessor.extras.componentCount;
  const x = count > 1 ? `x${count}` : '';
  switch (accessor.componentType) {
    case GL.BYTE: return `s${norm}8${x}` as GPUVertexFormat;
    case GL.UNSIGNED_BYTE: return `u${norm}8${x}` as GPUVertexFormat;
    case GL.SHORT: return `s${norm}16${x}` as GPUVertexFormat;
    case GL.UNSIGNED_SHORT: return `u${norm}16${x}` as GPUVertexFormat;
    case GL.UNSIGNED_INT: return `u${norm}32${x}` as GPUVertexFormat;
    case GL.FLOAT: return `float32${x}` as GPUVertexFormat;
  }
}

function gpuIndexFormatForComponentType(componentType: GLenum): GPUIndexFormat {
  switch (componentType) {
    case GL.UNSIGNED_SHORT: return 'uint16';
    case GL.UNSIGNED_INT: return 'uint32';
    default: return undefined;
  }
}

function gpuPrimitiveTopologyForMode(mode: GLenum): GPUPrimitiveTopology {
  switch (mode) {
    case GL.TRIANGLES: return 'triangle-list';
    case GL.TRIANGLE_STRIP: return 'triangle-strip';
    case GL.LINES: return 'line-list';
    case GL.LINE_STRIP: return 'line-strip';
    case GL.POINTS: return 'point-list';
  }
}

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

const ATTRIB_MAPPING = {
  POSITION: 'position',
  NORMAL: 'normal',
  TANGENT: 'tangent',
  TEXCOORD_0: 'texcoord',
  TEXCOORD_1: 'texcoord2',
  COLOR_0: 'color',
  JOINTS_0: 'joints',
  WEIGHTS_0: 'weights',
};

export interface GltfResult {
  scene: SceneObject,
  animations: Animation[],
  core:any
  skinBindGroup:any
  skinBindGroupLayout:any
}

export class GltfLoader {
  #hoardLoader: WebGpuGltfLoader;
  skinBindGroup:any
  skinBindGroupLayout:any
  renderGeometryManager:any
  gltf:any
  constructor(public renderer: any) {
    this.#hoardLoader = new WebGpuGltfLoader(renderer.device, [ComputeAABB], { additionalBufferUsageFlags: GPUBufferUsage.STORAGE });
     this.skinBindGroupLayout = renderer.device.createBindGroupLayout({
      label: 'skin bind group layout',
      entries: [{
        binding: 0,
        buffer: { type: 'read-only-storage' },
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE
      }, {
        binding: 1,
        buffer: { type: 'read-only-storage' },
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE
      }]
    });

      this.renderGeometryManager = new RenderGeometryManager(renderer.device);
  }

  get textureLoader(): WebGpuTextureLoader {
    return this.#hoardLoader.textureLoader;
  }

  clearCache() {
    this.#hoardLoader.clearCache();
  }
 createSkin(desc: SkinDescriptor): RenderSkin {
    let invBindMatrixCount = desc.inverseBindMatrices.length;
    if (desc.inverseBindMatrices instanceof Float32Array) {
      invBindMatrixCount = desc.inverseBindMatrices.length / 16;
    }

    // Create an fill the inverse bind matrix buffer.
    const invBindBuffer = this.renderer.device.createBuffer({
      label: 'skin inverse bind matrix buffer',
      size: invBindMatrixCount * 16 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    const invBindArray = new Float32Array(invBindBuffer.getMappedRange());
    if (desc.inverseBindMatrices instanceof Float32Array) {
      invBindArray.set(desc.inverseBindMatrices);
    } else {
      for (const [index, invBindMatrix] of desc.inverseBindMatrices.entries()) {
        invBindArray.set(invBindMatrix, index * 16);
      }
    }
    invBindBuffer.unmap();

    const jointBuffer = this.renderer.device.createBuffer({
      label: 'skin joint buffer',
      size: desc.joints.length * 16 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Create a bind group for both the inverse bind matrix buffer and the joint buffer.
    this.skinBindGroup = this.renderer.device.createBindGroup({
      label: 'skin bind group',
      layout: this.skinBindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: invBindBuffer },
      }, {
        binding: 1,
        resource: { buffer: jointBuffer },
      }]
    });

    return new RenderSkin(this as any, this.skinBindGroup, desc.joints, invBindBuffer, jointBuffer);
  }

  async loadFromUrl(url: string): Promise<GltfResult> {
    const gltf = await this.#hoardLoader.loadFromUrl(url);
    this.gltf = gltf
   
    const renderMaterials: any[] = [];

    function getTexture(textureInfo: any) {
      const index = textureInfo?.index;
      if (index == undefined) {
        return null;
      }

      const texture = gltf.textures[index];
      return texture?.extras?.gpu?.texture;
    }

    //-----------
    // Materials
    //-----------
    for (const material of (gltf.materials as any[])) {
      let unlit = (!!material.extensions?.KHR_materials_unlit);

      const emissiveStrength: number = material.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1;
      const emissiveFactor = new Vec3(material.emissiveFactor || 1);
      emissiveFactor.scale(emissiveStrength);

      renderMaterials.push({
        label: material.name,
        baseColorFactor: material.pbrMetallicRoughness?.baseColorFactor,
        baseColorTexture: getTexture(material.pbrMetallicRoughness?.baseColorTexture),
        metallicFactor: material.pbrMetallicRoughness?.metallicFactor,
        roughnessFactor: material.pbrMetallicRoughness?.roughnessFactor,
        metallicRoughnessTexture: getTexture(material.pbrMetallicRoughness?.metallicRoughnessTexture),
        normalTexture: getTexture(material.normalTexture),
        occlusionTexture: getTexture(material.occlusionTexture),
        occlusionStrength: material.occlusionTexture?.strength,
        emissiveFactor,
        emissiveTexture: getTexture(material.emissiveTexture),
        transparent: material.alphaMode == 'BLEND',
        alphaCutoff: material.alphaMode == 'MASK' ? (material.alphaCutoff ?? 0.5) : 0,
        unlit,
      });
    }

    //-----------
    // Meshes
    //-----------
    const meshes = [];
    for (let i = 0; i < (gltf.meshes as any[]).length; ++i) {
      const mesh = gltf.meshes[i];

      const primitives = [];
      for (const primitive of mesh.primitives) {
        const primitiveDescriptor: Partial<any> = {
          label: primitive.name,
          topology: gpuPrimitiveTopologyForMode(primitive.mode),
        };

        for (const [attribName, accessorIndex] of Object.entries(primitive.attributes)) {
          const primitiveAttrib = ATTRIB_MAPPING[attribName];
          if (!primitiveAttrib) {
            console.log(`Skipping unknown attribute ${attribName}`);
            continue;
          }
          const accessor = gltf.accessors[accessorIndex as number];
          const bufferView = gltf.bufferViews[accessor.bufferView];

          primitiveDescriptor[primitiveAttrib] = {
            values: bufferView.extras.gpu.buffer,
            offset: accessor.byteOffset,
            stride: bufferView.byteStride || accessor.extras.packedByteStride,
            format: gpuFormatForAccessor(accessor),
          };

          primitiveDescriptor.drawCount = accessor.count;
             
        }

        if ('indices' in primitive) {
          const accessor = gltf.accessors[primitive.indices];
           console.log( accessor)
          const bufferView = gltf.bufferViews[accessor.bufferView];
          primitiveDescriptor.indices = {
            values: bufferView.extras.gpu.buffer,
            offset: accessor.byteOffset,
            format: gpuIndexFormatForComponentType(accessor.componentType),
          };
          primitiveDescriptor.drawCount = accessor.count;
      
        }

        const renderMesh = {
          geometry: this.renderGeometryManager.createGeometry(primitiveDescriptor as GeometryDescriptor),
          material: renderMaterials[primitive.material],
        };
        primitives.push(renderMesh);
      }

      meshes.push(primitives);
    }

    //------------
    // Animations
    //------------

    function getAccessorTypedArray(accessor: any): ArrayBufferView {
      const bufferView = gltf.bufferViews[accessor.bufferView];
      const byteArray = bufferView.byteArray;

      // TODO: Does this need to take into account non-tightly packed buffers?

      const typedArrayOffset = bufferView.byteOffset + accessor.byteOffset;
      const elementCount = accessor.extras.componentCount * accessor.count;
      const arrayType = getComponentTypeArrayConstructor(accessor.componentType);
      return new arrayType(byteArray.buffer, typedArrayOffset, elementCount);
    }

    const animations = [];
    if (gltf.animations) {
      for (const animation of (gltf.animations as any[])) {

        const channels: AnimationChannel[] = [];
        for (const channel of animation.channels) {
          const channelSampler = animation.samplers[channel.sampler];

          let samplerType: any;
          switch(channelSampler.interpolation) {
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

          const inputAccessor = gltf.accessors[channelSampler.input];
          const outputAccessor = gltf.accessors[channelSampler.output];
          const sampler = new samplerType(
            getAccessorTypedArray(inputAccessor),
            getAccessorTypedArray(outputAccessor),
            outputAccessor.extras.componentCount
          );

          channels.push(new AnimationChannel(channel.target.node, channel.target.path, sampler));
        }

        animations.push(new Animation(animation.name || `Animation_${animations.length}`, channels));
      }
    }

    //-------
    // Skins
    //-------
    const skins = [];
    if (gltf.skins) {
      for (const skin of (gltf.skins as any[])) {
        console.log(gltf.skins)
        // TODO: May not have an inverseBindMatrices, if so should fill with identity matrices.
        const invBindMatrixAccessor = gltf.accessors[skin.inverseBindMatrices];
        const inverseBindMatrices = getAccessorTypedArray(invBindMatrixAccessor) as Float32Array;

        skins.push(this.createSkin({
          inverseBindMatrices,
          joints: skin.joints
        }));
      }
    }

    //-----------
    // Nodes
    //-----------
    const sceneNodes = [];

    // Two passes over the nodes. First to construct the node objects.
    for (const node of (gltf.nodes as any[])) {
      let transform: AbstractTransform;
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
          geometry: meshes[node.mesh],
        }));
      } else {
   
        sceneNodes.push(new SceneObject({
          transform
        }));
      }
    }
    console.log("sceneNodes on gltf.ts",sceneNodes)
    const animationTarget = new AnimationTarget(sceneNodes);

    // Second pass over the nodes to build the tree.
    for (const [index, node] of (gltf.nodes as any[]).entries()) {
      const sceneNode = sceneNodes[index];
      if (node.skin !== undefined) {
        const mesh = (sceneNode as Mesh);
        mesh.skin = skins[node.skin];
        mesh.animationTarget = animationTarget;
      }
      if (!node.children) { continue; }
      for (const child of node.children) {
        sceneNode.addChild(sceneNodes[child]);
      }
    }

    // @ts-ignore
    const scene = gltf.scenes[gltf.scene];
    const sceneAabb = scene.extras.aabb;

    // HACK!
    const sceneTransform = new Mat4();
    if (url.includes('Sponza')) {
      sceneTransform.translate([-sceneAabb.center[0], -sceneAabb.center[1]*0.5, -sceneAabb.center[2]]);
    } else if (url.includes('dragon')) {
      const scale = 0.5;
      sceneTransform.scale([scale, scale, scale]);
      sceneTransform.translate([-sceneAabb.center[0] * 1.2, -sceneAabb.center[1], -sceneAabb.center[2] * -0.5]);
    } else {
      sceneTransform.scale([2/sceneAabb.radius, 2/sceneAabb.radius, 2/sceneAabb.radius]);
      sceneTransform.translate([-sceneAabb.center[0], -sceneAabb.center[1], -sceneAabb.center[2]]);
    }

    const sceneRoot = new SceneObject({
      transform: new MatrixTransform(sceneTransform)
    });

    for (const nodeIndex of scene.nodes) {
      sceneRoot.addChild(sceneNodes[nodeIndex]);
    }

    sceneRoot.animationTarget = animationTarget;

    return {
      core:this.gltf,
      scene: sceneRoot,
      animations,
      skinBindGroup:this.skinBindGroup,
      skinBindGroupLayout:this.skinBindGroupLayout
    };
  }
}