export const createPlaneSample = (device: GPUDevice) => {
    // Tạo plane đơn giản 2x2, 2 tam giác, có vị trí và UV
    // Vertex data: [x,y,z, u,v]
    const vertices = new Float32Array([
        -1, 0, -1, 0, 0,
        1, 0, -1, 1, 0,
        1, 0, 1, 1, 1,
        -1, 0, 1, 0, 1,
    ]);

    const vertexBuffer = device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
    vertexBuffer.unmap();

    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    const indexCount = indices.length;

    const indexBuffer = device.createBuffer({
        size: indices.byteLength,
        usage: GPUBufferUsage.INDEX,
        mappedAtCreation: true,
    });
    new Uint16Array(indexBuffer.getMappedRange()).set(indices);
    indexBuffer.unmap();
    return {
        vertexBuffer: vertexBuffer,
        indexCount: indexCount,
        indexBuffer: indexBuffer
    }
}