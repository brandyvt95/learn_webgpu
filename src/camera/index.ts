import { GUI } from 'dat.gui';
import { mat4, vec3 } from 'wgpu-matrix';
import { ArcballCamera, WASDCamera } from './config';
import { createInputHandler } from '../intractive';
export function initCamera(window: any, canvas: any) {

  const initialCameraPosition = vec3.create(0, 0, 5);
  const cameras = {
    arcball: new ArcballCamera({ position: initialCameraPosition }),
    WASD: new WASDCamera({ position: initialCameraPosition }),
  };
  const inputHandler = createInputHandler(window, canvas);

  const aspect = canvas.width / canvas.height;

  const params: { type: 'arcball' | 'WASD' } = {
    type: 'arcball',
  };
  let oldCameraType = params.type;
  const gui = new GUI();
  gui.add(params, 'type', ['arcball', 'WASD']).onChange(() => {
    // Copy the camera matrix from old to new
    const newCameraType = params.type;
    cameras[newCameraType].matrix = cameras[oldCameraType].matrix;
    oldCameraType = newCameraType;
  });

  const projectionMatrix = mat4.perspective((2 * Math.PI) / 4, aspect, .1, 100.0);
  const modelViewProjectionMatrix = mat4.create();
  const modelMatrix = mat4.create(); //
  function getModelViewProjectionMatrix(deltaTime: number) {
    const camera = cameras[params.type];
    const viewMatrix = camera.update(deltaTime, inputHandler());
    mat4.multiply(projectionMatrix, viewMatrix, modelViewProjectionMatrix);
    return { modelViewProjectionMatrix, viewMatrix };
  }
  return {
    getModelViewProjectionMatrix,
    camera:cameras[params.type]
  };
}
