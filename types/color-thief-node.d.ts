declare module "color-thief-node" {
  export function getColor(buffer: Buffer): [number, number, number];
  export function getPalette(buffer: Buffer, colorCount?: number): [number, number, number][];
}
