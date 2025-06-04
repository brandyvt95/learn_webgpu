export const COMMON_DEPTH_MSAA_DESC = {
  depthStencil: {
    depthWriteEnabled: false,
    depthCompare: "less",
    format: "depth24plus",
  },
  multisample: {
    count: 1, // <- quan trọng nếu bạn dùng MSAA
  },
}