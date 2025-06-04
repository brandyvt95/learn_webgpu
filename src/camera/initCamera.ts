import { createBindGroupCluster } from "../bitonicSort/utils";
import { OrbitCamera } from "./OrbitCamera";

export class CameraInitializer {
    private CORE_ENGINE: any;
    public camera: OrbitCamera | null = null;
    private _cameraBGCluster: any;
    private _bufferCamera: any;
    private BUFFER_CAMERA_UNIFORM: any
    constructor({ CORE_ENGINE, type }: { CORE_ENGINE: any, type: string }) {
        this.CORE_ENGINE = CORE_ENGINE;
        if (type === 'OrbitCamera') {
            this.initialize()
        }
    }

    get cameraBGCluster() {
        return this._cameraBGCluster;
    }
    get bufferCamera() {
        return this._bufferCamera;
    }

    initialize() {

        this.camera = new OrbitCamera(this.CORE_ENGINE.canvas.el);
        this.camera.target = [0, 0, 0];

        const mat4Size = 64; // 4 * 4 * 4 bytes (4x4 matrix float32)
        const vec3AlignedSize = 16; // vec3 + padding to 16 bytes

        const BUFFER_CAMERA_UNIFORM_SIZE = mat4Size * 3 + vec3AlignedSize; // 192 + 16 = 208 bytes

        this._bufferCamera = this.CORE_ENGINE.device.createBuffer({
            size: BUFFER_CAMERA_UNIFORM_SIZE,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this._cameraBGCluster = createBindGroupCluster(
            [0],                               // binding indices
            [GPUShaderStage.VERTEX],           // shader visibilities
            ['buffer'],                        // resource types
            [{ type: 'uniform' }],             // resource layouts
            [[{ buffer: this._bufferCamera }]], // resources: array of arrays of GPUBindingResource
            'SharedCamera',
            this.CORE_ENGINE.device
        );
    }

    update() {
        this.camera.update()
        const cameraData = new Float32Array(208 / 4); // = 52 floats // 4 m4 + 1 v3
        // Fill: matrixA (16 floats), matrixB (16 floats), matrixC (16 floats)
        cameraData.set(this.camera.modelMatrix, 0);
        cameraData.set(this.camera.viewMatrix, 16);
        cameraData.set(this.camera.projectionMatrix, 32);
        // Fill vec3 (3 floats)
        cameraData.set(this.camera.position, 48);
        // Padding (1 float, optional: can be zero)
        cameraData[51] = 0;
        this.CORE_ENGINE.device.queue.writeBuffer(this._bufferCamera, 0, cameraData.buffer);
    }
}
