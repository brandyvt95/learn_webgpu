import { loadCubemapTexture } from "./loader/cubeMap";
import { GltfLoader } from "./loader/gltf";


export async function loadAssets({ device,ASSETS_DESC }: { device: GPUDevice,ASSETS_DESC:any }) {
  const result_textures = await loadTextures({ device: device, desc: ASSETS_DESC.TEXTURE })
  const result_models = await loadModels({ device: device, desc: ASSETS_DESC.MODEL })
  return {
    textures: {
      ...result_textures
    },
    models: {
     // ...result_models
    }
  }
}



export async function loadTextures({ device, desc }: { device: GPUDevice, desc: any[] }) {
  const result: Record<string, GPUTexture> = {};
  for (let i = 0; i < desc.length; i++) {
    const item = desc[i];

    if (item.type === "cubemap_texture" && Array.isArray(item.url)) {
      const cubemap = await loadCubemapTexture(device, item.url);
      result[item.type] = cubemap;
    }
    else if (item.type === "texture2d" && typeof item.url === "string") {
      //const texture2d = await loadTexture2D(device, item.url);
      result["texture2d"] = null;
    }
  }

  return result;
}

export async function loadModels({ device, desc }: { device: GPUDevice, desc: any[] }) {
  const result: Record<string, any> = {};
  const renderParam = { device };
  const gltfLoader = new GltfLoader(renderParam);

  for (const item of desc) {
    const output = await gltfLoader.loadFromUrl(item.url);
    result[item.name] = output;
  }
  return result;
}

