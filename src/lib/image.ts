/**
 * Reduce una foto a máximo 1600 px por lado y la convierte a JPEG liviano (unos 200–400 KB),
 * para que suba rápido con datos móviles y no llene el almacenamiento.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.72): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)

    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo preparar la foto')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo comprimir la foto'))),
        'image/jpeg',
        quality,
      )
    })
  } finally {
    bitmap.close()
  }
}
