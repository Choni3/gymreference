// On-device image helpers: downscale photos and grab frames from videos.

const MAX_SIDE = 1600;
const QUALITY = 0.82;

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', QUALITY)
  );
}

// One shared canvas: iOS caps total canvas memory, so a new canvas per photo can fail
// when adding many at once. toBlob() snapshots the pixels, so reuse is safe.
let canvas;
function drawScaled(source, w, h) {
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  canvas ||= document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read ${file.name || 'image'}`));
    };
    img.src = url;
  });
}

// Image file -> compressed JPEG blob.
export async function compressImage(file) {
  const { img, url } = await loadImage(file);
  try {
    return await canvasToBlob(drawScaled(img, img.naturalWidth, img.naturalHeight));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Current frame of a <video> element -> compressed JPEG blob.
export function captureFrame(video) {
  return canvasToBlob(drawScaled(video, video.videoWidth, video.videoHeight));
}

export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function dataURLToBlob(dataURL) {
  return (await fetch(dataURL)).blob();
}
