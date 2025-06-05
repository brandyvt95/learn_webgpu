import { vec3, mat4 } from 'wgpu-matrix';
import { createModelMatrix, updateProjection } from './utils';

export class OrbitCamera {
  public orbitX: number = 0;
  public orbitY: number = 0;
  public maxOrbitX: number = Math.PI * 0.5;
  public minOrbitX: number = -Math.PI * 0.5;
  public maxOrbitY: number = Math.PI;
  public minOrbitY: number = -Math.PI;
  public constrainXOrbit: boolean = true;
  public constrainYOrbit: boolean = false;

  public maxDistance: number = 10;
  public minDistance: number = 1;
  public distanceStep: number = 0.005;
  public constrainDistance: boolean = false;
  private targetDistance: number = 2;

  public modelMatrix: Float32Array = mat4.create();
  public projectionMatrix: Float32Array = mat4.create();
  public mvpMatrix: Float32Array = mat4.create();
  public fov: number = 45;
  public near: number = .01;
  public far: number = 100;


  private distance_: Float32Array = vec3.fromValues(0, 0, 5);
  private target_: Float32Array = vec3.create();
  private viewMat_: Float32Array = mat4.create();
  private cameraMat_: Float32Array = mat4.create();
  private position_: Float32Array = vec3.create();
  private dirty_: boolean = true;

  private element_: HTMLElement | null = null;
  private registerElement_: (element: HTMLElement | null) => void;

  private xDelta = 0;
  private yDelta = 0;
  private targetXDelta = 0;
  private targetYDelta = 0;


  constructor(element: HTMLElement | null = null) {
    let moving = false;
    let lastX: number, lastY: number;

    this.modelMatrix = createModelMatrix([0, 0, 0], [0, Math.PI * 0, 0], [1, 1, 1]);
    this.projectionMatrix = mat4.create();
    this.mvpMatrix = mat4.create();


    const downCallback = (event: PointerEvent): void => {
      if (event.isPrimary) {
        moving = true;
      }
      lastX = event.pageX;
      lastY = event.pageY;
    };

    const moveCallback = (event: PointerEvent): void => {
      if (document.pointerLockElement) {
        this.targetXDelta += event.movementX * 0.025;
        this.targetYDelta += event.movementY * 0.025;
      } else if (moving) {
        const dx = event.pageX - lastX;
        const dy = event.pageY - lastY;
        lastX = event.pageX;
        lastY = event.pageY;

        this.targetXDelta += dx * 0.025;
        this.targetYDelta += dy * 0.025;
      }
    };


    const upCallback = (event: PointerEvent): void => {
      if (event.isPrimary) {
        moving = false;
      }
    };

    const wheelCallback = (event: WheelEvent): void => {
      //this.distance = this.distance_[2] + (event.deltaY * this.distanceStep * 4.3);
      const delta = event.deltaY * this.distanceStep * 0.3;
      this.targetDistance = this.distance_[2] + delta;

      event.preventDefault();
    };

    this.registerElement_ = (value: HTMLElement | null): void => {
      if (this.element_ && this.element_ !== value) {
        this.element_.removeEventListener('pointerdown', downCallback);
        this.element_.removeEventListener('pointermove', moveCallback);
        this.element_.removeEventListener('pointerup', upCallback);
        this.element_.removeEventListener('wheel', wheelCallback);
      }

      this.element_ = value;
      if (this.element_) {
        this.element_.addEventListener('pointerdown', downCallback);
        this.element_.addEventListener('pointermove', moveCallback);
        this.element_.addEventListener('pointerup', upCallback);
        this.element_.addEventListener('wheel', wheelCallback);
      }
    };

    this.element_ = element;
    this.registerElement_(element);
  }

  set element(value: HTMLElement | null) {
    this.registerElement_(value);
  }

  get element(): HTMLElement | null {
    return this.element_;
  }

  public orbit(xDelta: number, yDelta: number): void {
    if (xDelta || yDelta) {
      this.orbitY += xDelta;
      if (this.constrainYOrbit) {
        this.orbitY = Math.min(Math.max(this.orbitY, this.minOrbitY), this.maxOrbitY);
      } else {
        while (this.orbitY < -Math.PI) {
          this.orbitY += Math.PI * 2;
        }
        while (this.orbitY >= Math.PI) {
          this.orbitY -= Math.PI * 2;
        }
      }

      this.orbitX += yDelta;
      if (this.constrainXOrbit) {
        this.orbitX = Math.min(Math.max(this.orbitX, this.minOrbitX), this.maxOrbitX);
      } else {
        while (this.orbitX < -Math.PI) {
          this.orbitX += Math.PI * 2;
        }
        while (this.orbitX >= Math.PI) {
          this.orbitX -= Math.PI * 2;
        }
      }

      this.dirty_ = true;
    }
  }

  get target(): [number, number, number] {
    return [this.target_[0], this.target_[1], this.target_[2]];
  }

  set target(value: [number, number, number] | Float32Array) {
    this.target_[0] = value[0];
    this.target_[1] = value[1];
    this.target_[2] = value[2];
    this.dirty_ = true;
  }

  get distance(): number {
    return this.distance_[2];
  }

  set distance(value: number) {
    this.distance_[2] = value;
    if (this.constrainDistance) {
      this.distance_[2] = Math.min(
        Math.max(this.distance_[2], this.minDistance),
        this.maxDistance
      );
    }
    this.dirty_ = true;
  }
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
  update() {
    this.xDelta = this.lerp(this.xDelta, this.targetXDelta, 0.1);
    this.yDelta = this.lerp(this.yDelta, this.targetYDelta, 0.1);
    if (Math.abs(this.xDelta) > 0.001 || Math.abs(this.yDelta) > 0.001) {
      this.orbit(this.xDelta, this.yDelta);
      this.targetXDelta *= 0.2;
      this.targetYDelta *= 0.2;
    }
    this.distance = this.lerp(this.distance, this.targetDistance, 0.1);
  }
  private updateMatrices_(): void {
    if (this.dirty_) {

      const mv = this.cameraMat_;
      mat4.identity(mv);

      mat4.translate(mv, this.target_, mv);
      mat4.rotateY(mv, -this.orbitY, mv);
      mat4.rotateX(mv, -this.orbitX, mv);
      mat4.translate(mv, this.distance_, mv);
      mat4.invert(this.cameraMat_, this.viewMat_);


      updateProjection(this.element_, this.projectionMatrix, this.fov, this.near, this.far);

      mat4.mul(this.projectionMatrix, this.viewMat_, this.mvpMatrix); // P × V
      mat4.mul(this.mvpMatrix, this.modelMatrix, this.mvpMatrix);

      this.dirty_ = false;
    }
  }

  get position(): Float32Array {
    this.updateMatrices_();
    vec3.set(0, 0, 0, this.position_);
    vec3.transformMat4(this.position_, this.cameraMat_, this.position_);
    return this.position_;
  }

  get viewMatrix(): Float32Array {
    this.updateMatrices_();
    return this.viewMat_;
  }
}