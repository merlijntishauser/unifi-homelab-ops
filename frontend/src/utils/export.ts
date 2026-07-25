export function downloadSvg(svgContent: string, filename: string = "topology.svg"): void {
  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* v8 ignore start -- requires real browser canvas/Image APIs not available in jsdom */
export function downloadPng(svgContent: string, filename: string = "topology.png", scale: number = 2): Promise<void> {
  return new Promise((resolve, reject) => {
    // A data URI (rather than an object URL) keeps no Blob alive past this call,
    // and is still same-origin so the canvas stays untainted for toBlob().
    const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context not available"));
        return;
      }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) {
          reject(new Error("PNG conversion failed"));
          return;
        }
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(pngUrl);
        resolve();
      }, "image/png");
    };
    img.onerror = () => {
      reject(new Error("Failed to load SVG as image"));
    };
    img.src = dataUri;
  });
}
/* v8 ignore stop */
