import QRCode from "qrcode";

export async function generateQRCode(url: string): Promise<string> {
  const dataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 256,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return dataUrl;
}

export async function generateQRCodeBuffer(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });
}
