import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const imageRoot = path.join(root, 'public', 'image');
const threshold = 500 * 1024;
const textRoots = ['app', 'components', 'data', 'posts', 'chatters', 'moments', 'public'];
const textExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.md', '.json']);

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

const textFiles = (await Promise.all(textRoots.map((name) => walk(path.join(root, name))))).flat()
  .filter((file) => textExtensions.has(path.extname(file).toLowerCase()));
textFiles.push(path.join(root, 'siteConfig.ts'));

const report = [];
for (const source of await walk(imageRoot)) {
  const extension = path.extname(source).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(extension)) continue;
  const before = (await fs.stat(source)).size;
  if (before <= threshold) continue;

  const destination = source.slice(0, -extension.length) + '.webp';
  const temporary = `${destination}.tmp`;
  try {
    await sharp(source, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84, effort: 5 })
      .toFile(temporary);
    const after = (await fs.stat(temporary)).size;
    if (after >= before * 0.85) {
      await fs.unlink(temporary);
      report.push({ file: path.relative(root, source), before, after, action: 'kept-original' });
      continue;
    }

    await fs.rm(destination, { force: true });
    await fs.rename(temporary, destination);
    const oldName = path.basename(source);
    const newName = path.basename(destination);
    let referencesUpdated = 0;
    for (const textFile of textFiles) {
      let content;
      try { content = await fs.readFile(textFile, 'utf8'); } catch { continue; }
      if (!content.includes(oldName)) continue;
      const updated = content.replaceAll(oldName, newName);
      if (updated !== content) {
        await fs.writeFile(textFile, updated, 'utf8');
        referencesUpdated += 1;
      }
    }
    await fs.unlink(source);
    report.push({ file: path.relative(root, source), output: path.relative(root, destination), before, after, referencesUpdated, action: 'converted' });
  } catch (error) {
    await fs.rm(temporary, { force: true });
    report.push({ file: path.relative(root, source), action: 'error', error: String(error) });
  }
}

await fs.mkdir(path.join(root, '.next'), { recursive: true });
await fs.writeFile(path.join(root, '.next', 'image-optimization-report.json'), JSON.stringify(report, null, 2));
const saved = report.filter((item) => item.action === 'converted').reduce((sum, item) => sum + item.before - item.after, 0);
console.log(`Converted ${report.filter((item) => item.action === 'converted').length} images; saved ${(saved / 1024 / 1024).toFixed(2)} MB.`);
