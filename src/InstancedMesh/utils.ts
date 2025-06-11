export const mergerBuffer = (arrays, type) => {
    if (!arrays.length) return null;

    // Chọn constructor dựa vào type truyền vào
    let Constructor;
    if (type === 'float32') {
      Constructor = Float32Array;
    } else if (type === 'uint32') {
      Constructor = Uint32Array;
    } else {
      throw new Error('Unsupported type: ' + type);
    }

    // Tính tổng chiều dài
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);

    // Tạo mảng kết quả đúng kiểu và đủ dài
    const result = new Constructor(totalLength);

    // Gộp từng mảng con vào mảng kết quả
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }

    return result;
  }