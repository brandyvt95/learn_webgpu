import { WebGpuGltfLoader } from '../third-party/hoard-gpu/dist/gltf/webgpu-gltf-loader.js'
import { WebGpuTextureLoader } from '../third-party/hoard-gpu/dist/texture/webgpu/webgpu-texture-loader.js'
import { ComputeAABB } from '../third-party/hoard-gpu/dist/gltf/transforms/compute-aabb.js'

export interface GltfResult {
  scene: any,
  animations: Animation[],
  core:any
}
export class GltfLoader {
  #hoardLoader: WebGpuGltfLoader;

  constructor(public renderer: any) {
    this.#hoardLoader = new WebGpuGltfLoader(renderer.device, [ComputeAABB], { additionalBufferUsageFlags: GPUBufferUsage.STORAGE });
  }

  get textureLoader(): WebGpuTextureLoader {
    return this.#hoardLoader.textureLoader;
  }

  clearCache() {
    this.#hoardLoader.clearCache();
  }

  async loadFromUrl(url: string): Promise<GltfResult> {


    const gltf = await this.#hoardLoader.loadFromUrl(url);
    let sceneRoot, animations
    return {
        core:gltf,
        scene: sceneRoot,
        animations
    };
  }
}