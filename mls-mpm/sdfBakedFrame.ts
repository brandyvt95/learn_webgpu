export async function sdfBakedFrame(
    device: GPUDevice,
    imgSrcs: string[]
): Promise<any> {

    const imageBitmaps = await Promise.all(
        imgSrcs.map(async (src) => {
            const response = await fetch(src);
            const blob = await response.blob();
            return await createImageBitmap(blob);
        })
    );
    console.log(imageBitmaps)
    return null
}