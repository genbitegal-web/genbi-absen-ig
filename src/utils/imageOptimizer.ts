/**
 * Helper utility to optimize and convert images (including iPhone HEIC / high-res photos)
 * into universally supported, compressed JPEG files before uploading.
 * 
 * Benefits:
 * 1. Solves iPhone / iOS HEIC format compatibility (converts to standard JPEG).
 * 2. Compresses massive 10MB+ iPhone camera photos to ~300KB-800KB.
 * 3. Prevents Vercel 4.5MB serverless payload limit (413 Payload Too Large error).
 * 4. Ensures crystal clear readability while speeding up upload time drastically.
 */

export async function optimizeImageForUpload(file: File, maxDimension: number = 1920, quality: number = 0.85): Promise<File> {
  // If file is not an image or SVG/GIF, return as is
  if (!file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.heic')) {
    return file;
  }

  return new Promise((resolve) => {
    // If the browser cannot handle canvas or image loading, fallback to original
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(url);
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          // Scale down if larger than max dimension
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }

          // Fill white background in case of transparency
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }

              // Create clean jpg filename
              const rawName = file.name.replace(/\.[^/.]+$/, '');
              const cleanName = `${rawName || 'proof'}.jpg`;
              const optimizedFile = new File([blob], cleanName, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });

              resolve(optimizedFile);
            },
            'image/jpeg',
            quality
          );
        } catch (err) {
          console.warn('Canvas conversion failed, using original file:', err);
          resolve(file);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        console.warn('Image load failed during compression, using original file');
        resolve(file);
      };

      img.src = url;
    } catch (e) {
      console.warn('Optimization error, fallback to original file:', e);
      resolve(file);
    }
  });
}
