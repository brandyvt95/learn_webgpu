export function getAccessorData(gltf: any, accessorIndex: number): ArrayBuffer {
  const accessor = gltf.accessors[accessorIndex];
  const bufferView = gltf.bufferViews[accessor.bufferView];
  const buffer = gltf.buffers[bufferView.buffer];

  // buffer.data là Uint8Array chứa toàn bộ dữ liệu gốc (đã được decode base64 hoặc fetch)
  // Nếu bạn chưa có buffer.data thì bạn cần load dữ liệu từ file .bin trước rồi gán ở buffer.data

  // offset bắt đầu trong buffer (tính cả byteOffset của bufferView và accessor)
  const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
  const byteLength = accessor.count * getNumComponents(accessor.type) * getComponentSize(accessor.componentType);

  // Lấy phần slice đúng trong buffer.data
  const bufferData = buffer.data; // Uint8Array
  if (!bufferData) throw new Error("Buffer data not loaded!");

  // Tạo slice ArrayBuffer cho accessor
  const slice = bufferData.buffer.slice(bufferData.byteOffset + byteOffset, bufferData.byteOffset + byteOffset + byteLength);
  return slice;
}

function getNumComponents(type: string): number {
  // Loại dữ liệu glTF: SCALAR, VEC2, VEC3, VEC4, MAT2, MAT3, MAT4
  switch (type) {
    case "SCALAR": return 1;
    case "VEC2": return 2;
    case "VEC3": return 3;
    case "VEC4": return 4;
    case "MAT2": return 4;
    case "MAT3": return 9;
    case "MAT4": return 16;
    default: throw new Error("Unknown accessor type: " + type);
  }
}

function getComponentSize(componentType: number): number {
  // glTF component types (https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#component-types)
  // 5120 = BYTE (1 byte), 5121 = UNSIGNED_BYTE (1 byte)
  // 5122 = SHORT (2 bytes), 5123 = UNSIGNED_SHORT (2 bytes)
  // 5125 = UNSIGNED_INT (4 bytes), 5126 = FLOAT (4 bytes)
  switch (componentType) {
    case 5120: // BYTE
    case 5121: // UNSIGNED_BYTE
      return 1;
    case 5122: // SHORT
    case 5123: // UNSIGNED_SHORT
      return 2;
    case 5125: // UNSIGNED_INT
    case 5126: // FLOAT
      return 4;
    default:
      throw new Error("Unknown componentType: " + componentType);
  }
}
