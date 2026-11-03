import qrcode from "qrcode-generator";

export const verifyLink = (id) => `${location.origin}/verify?id=${id}`;
export const extractId = (t) => { const m = String(t).match(/CERT-[A-Z0-9]{6}/i); return m ? m[0].toUpperCase() : null; };

export function qrDataURL(text, px = 300) {
  const q = qrcode(0, "M");
  q.addData(text); q.make();
  const n = q.getModuleCount(), m = 2, s = Math.max(1, Math.ceil(px / (n + 2 * m)));
  const cv = document.createElement("canvas");
  cv.width = cv.height = (n + 2 * m) * s;
  const x = cv.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, cv.width, cv.height);
  x.fillStyle = "#000";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect((c + m) * s, (r + m) * s, s, s);
  return cv.toDataURL("image/png");
}

/** Printable card: QR + name + title + ID. Returns a PNG Blob. */
export function qrCardBlob(c) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = 640; cv.height = 740;
      const x = cv.getContext("2d");
      x.fillStyle = "#fff"; x.fillRect(0, 0, 640, 740);
      x.drawImage(img, 40, 30, 560, 560);
      x.fillStyle = "#14162b"; x.textAlign = "center";
      x.font = "bold 28px sans-serif"; x.fillText((c.name || "").slice(0, 34), 320, 640);
      x.font = "22px sans-serif"; x.fillText((c.title || "").slice(0, 44), 320, 676);
      x.font = "20px monospace"; x.fillText(c.id + (c.institute ? " · " + c.institute.slice(0, 24) : ""), 320, 712);
      cv.toBlob(resolve, "image/png");
    };
    img.src = qrDataURL(verifyLink(c.id), 560);
  });
}

export function saveBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
