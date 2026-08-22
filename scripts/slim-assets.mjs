import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();

// 1) 外链图床图片本地化：下载 -> 压缩 -> public/bg/
const externalMaps = [
  ['https://bu.dusays.com/2026/03/24/69c1e38b4c370.jpg', 'public/bg/home-1.webp'],
  ['https://bu.dusays.com/2026/03/24/69c26fe4acdb5.jpg', 'public/bg/home-2.webp'],
  ['https://bu.dusays.com/2026/03/24/69c26fe4d9486.jpg', 'public/bg/home-3.webp'],
  ['https://bu.dusays.com/2026/03/24/69c1e38b346cb.jpg', 'public/bg/cover.webp'],
  ['https://bu.dusays.com/2026/03/24/69c24230a5ff8.jpg', 'public/bg/music-default.webp'],
];

// 2) 本地大图瘦身（同名覆盖，不破坏引用）
const localDirs = ['public/image', 'public/comment-images'];
const localThreshold = 200 * 1024;

async function walk(directory) {
  const result = [];
  try {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) result.push(...await walk(fullPath));
      else result.push(fullPath);
    }
  } catch {}
  return result;
}

const report = [];

for (const [url, dest] of externalMaps) {
  try {
    const out = path.join(root, dest);
    if (await fs.stat(out).then(() => true, () => false)) continue; // 已存在则跳过
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const out = path.join(root, dest);
    await fs.mkdir(path.dirname(out), { recursive: true });
    const compressed = await sharp(buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 5 })
      .toBuffer();
    await fs.writeFile(out, compressed);
    report.push(`${path.basename(dest)}: ${(buffer.length/1024).toFixed(0)}KB -> ${(compressed.length/1024).toFixed(0)}KB`);
  } catch (error) {
    report.push(`FAIL ${url}: ${error.message}`);
  }
}

for (const dirName of localDirs) {
  for (const source of await walk(path.join(root, dirName))) {
    const extension = path.extname(source).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) continue;
    const before = (await fs.stat(source)).size;
    if (before <= localThreshold) continue;
    try {
      // 中文路径下 sharp 直接打开文件可能失败，统一先读入 Buffer
      const inputBuffer = await fs.readFile(source);
      let compressed;
      if (extension === '.webp') {
        compressed = await sharp(inputBuffer, { limitInputPixels: 40_000_000 })
          .rotate()
          .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 78, effort: 5 })
          .toBuffer();
      } else {
        // jpg/png 保持原格式原文件名，避免破坏评论/文章里的既有引用
        compressed = extension === '.png'
          ? await sharp(inputBuffer, { limitInputPixels: 40_000_000 }).resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9, quality: 78 }).toBuffer()
          : await sharp(inputBuffer, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
      }
      if (compressed.length < before * 0.9) {
        await fs.writeFile(source, compressed);
        report.push(`${path.relative(root, source)}: ${(before/1024).toFixed(0)}KB -> ${(compressed.length/1024).toFixed(0)}KB`);
      }
    } catch (error) {
      report.push(`SKIP ${path.relative(root, source)}: ${error.message}`);
    }
  }
}

console.log(report.join('\n'));
console.log(`\ndone: ${report.length} entries`);
