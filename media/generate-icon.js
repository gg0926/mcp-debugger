// 生成 Z 形 MCP Debugger 图标
// 风格：双层线条、立体感，与 VS Code 内置图标风格一致

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function createPng(width, height, pixelData) {
  const bytesPerPixel = 4;
  const filtered = Buffer.alloc(height * (width * bytesPerPixel + 1));
  for (let y = 0; y < height; y++) {
    filtered[y * (width * bytesPerPixel + 1)] = 0;
    pixelData.copy(
      filtered,
      y * (width * bytesPerPixel + 1) + 1,
      y * width * bytesPerPixel,
      (y + 1) * width * bytesPerPixel
    );
  }

  function crc32(data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
      }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBuffer = Buffer.from(type);
    const crcInput = Buffer.concat([typeBuffer, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcInput), 0);
    return Buffer.concat([length, typeBuffer, data, crc]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(filtered);
  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', compressed),
    createChunk('IEND', Buffer.alloc(0))
  ]);
}

function drawZIcon(size) {
  const data = Buffer.alloc(size * size * 4);

  for (let i = 0; i < size * size * 4; i += 4) {
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 0;
  }

  function setPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = a;
  }

  function drawLine(x1, y1, x2, y2, thickness, r, g, b, a = 255) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      const halfT = Math.floor(thickness / 2);
      for (let i = -halfT; i <= halfT; i++) {
        for (let j = -halfT; j <= halfT; j++) {
          setPixel(x1 + i, y1 + j, r, g, b, a);
        }
      }
      if (x1 === x2 && y1 === y2) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x1 += sx; }
      if (e2 < dx) { err += dx; y1 += sy; }
    }
  }

  const padding = Math.floor(size * 0.08);
  const topY = padding;
  const bottomY = size - padding;
  const leftX = padding;
  const rightX = size - padding;
  const thickness = Math.max(6, Math.floor(size * 0.15));

  // 下层阴影（深色、偏移）
  drawLine(leftX + 3, topY + 3, rightX + 3, topY + 3, thickness, 40, 60, 80, 150);
  drawLine(rightX + 3, topY + 3, leftX + 3, bottomY + 3, thickness, 40, 60, 80, 150);
  drawLine(leftX + 3, bottomY + 3, rightX + 3, bottomY + 3, thickness, 40, 60, 80, 150);

  // 上层主线条（白色/亮色）
  drawLine(leftX, topY, rightX, topY, thickness, 200, 210, 230, 255);
  drawLine(rightX, topY, leftX, bottomY, thickness, 200, 210, 230, 255);
  drawLine(leftX, bottomY, rightX, bottomY, thickness, 200, 210, 230, 255);

  return data;
}

const icon128 = drawZIcon(128);
fs.writeFileSync(path.join(__dirname, 'icon.png'), createPng(128, 128, icon128));

console.log('Generated icon.png (128x128)');
