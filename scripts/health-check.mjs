import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const publicJsonFiles = [
  'public/life-modules.json',
  'public/key-url-tables.json',
  'public/archive-collections.json',
];

const criticalTextFiles = [
  'components/Navbar.tsx',
  'components/KeyUrlPublicTable.tsx',
  'components/settings/KeyUrlSection.tsx',
  'components/settings/LifeModulesSection.tsx',
  'app/settings/page.tsx',
  'app/recommendations/page.tsx',
  'app/key-urls/page.tsx',
  'app/share/page.tsx',
  'app/api/public-chat/route.ts',
  'cms_core/api/sync.py',
  'cms_core/api/key_url_tables.py',
  'cms_core/api/drafts.py',
];

const mojibakePatterns = [
  /�/,
  /鍒|绔|涓|澶|褰|鐓|璇|瀵|妫|鏂|鎺|閾|馃|鈽|鉁/,
  /\?\?\?\?/,
  /Key \/ URL 管理表/,
  /Key 与链接/,
];

const interfaceChecks = [
  {
    file: 'components/Navbar.tsx',
    required: ['推荐表', '中转站', '/recommendations', '/key-urls'],
    forbidden: ["{ name: '分享表'"],
  },
  {
    file: 'app/share/page.tsx',
    required: ["redirect('/recommendations')"],
    forbidden: ['ShareBoard', 'KeyUrlPublicTable'],
  },
  {
    file: 'app/recommendations/page.tsx',
    required: ['推荐表', 'life-modules.json'],
    forbidden: [],
  },
  {
    file: 'app/key-urls/page.tsx',
    required: ['中转站', 'KeyUrlPublicTable'],
    forbidden: ['复制 Key', '显示 Key'],
  },
  {
    file: 'components/KeyUrlPublicTable.tsx',
    required: ['中转站', 'key-url-tables.json'],
    forbidden: ['复制 Key', '显示 Key'],
  },
];

const dependencyScanRoots = ['app', 'components', 'context', 'data', 'scripts'];
const dependencyScanExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);
const nodeBuiltins = new Set([
  'assert',
  'buffer',
  'child_process',
  'crypto',
  'events',
  'fs',
  'http',
  'https',
  'module',
  'net',
  'os',
  'path',
  'process',
  'querystring',
  'stream',
  'string_decoder',
  'timers',
  'tls',
  'tty',
  'url',
  'util',
  'vm',
  'zlib',
]);

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function hasKeyField(value) {
  if (Array.isArray(value)) return value.some(hasKeyField);
  if (value && typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'key')) return true;
    return Object.values(value).some(hasKeyField);
  }
  return false;
}

const failures = [];

function recommendationSignature(data) {
  const groups = Array.isArray(data?.recommendationGroups) ? data.recommendationGroups : [];
  return groups.flatMap((group) => {
    const items = Array.isArray(group?.items) ? group.items : [];
    return items.map((item) => [item?.id || '', item?.title || '', item?.url || '', item?.imageUrl || ''].join('|'));
  }).sort();
}

function compareSignatures(name, expected, actual) {
  const missing = expected.filter((item) => !actual.includes(item));
  const extra = actual.filter((item) => !expected.includes(item));
  if (missing.length || extra.length) {
    if (missing.length) failures.push(`${name} is missing recommendation items: ${missing.slice(0, 5).join('; ')}`);
    if (extra.length) failures.push(`${name} has unexpected recommendation items: ${extra.slice(0, 5).join('; ')}`);
  }
}

function walkFiles(relativeDir, result = []) {
  const fullDir = path.join(root, relativeDir);
  if (!fs.existsSync(fullDir)) return result;
  for (const entry of fs.readdirSync(fullDir, { withFileTypes: true })) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.git'].includes(entry.name)) continue;
      walkFiles(relativePath, result);
      continue;
    }
    if (dependencyScanExtensions.has(path.extname(entry.name))) {
      result.push(relativePath.replaceAll(path.sep, '/'));
    }
  }
  return result;
}

function packageNameFromSpecifier(specifier) {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('@/')) return null;
  if (specifier.startsWith('node:')) return null;
  const first = specifier.split('/')[0];
  if (nodeBuiltins.has(first)) return null;
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }
  return first;
}

function collectDependencyImports(text) {
  const imports = new Set();
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?[^'"]+?\s+from\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) {
      const packageName = packageNameFromSpecifier(match[1]);
      if (packageName) imports.add(packageName);
    }
  }
  return imports;
}

for (const file of publicJsonFiles) {
  try {
    const data = JSON.parse(read(file));
    console.log(`JSON OK: ${file}`);
    if (file.endsWith('life-modules.json')) {
      const signature = recommendationSignature(data);
      const managerDataPath = path.join(root, 'manager_data', 'life_modules.json');
      if (fs.existsSync(managerDataPath)) {
        const managerSignature = recommendationSignature(JSON.parse(fs.readFileSync(managerDataPath, 'utf8')));
        compareSignatures(file, managerSignature, signature);
      }
      console.log(`RECOMMENDATION OK: ${signature.length} items`);
    }
    if (file.endsWith('key-url-tables.json') && hasKeyField(data)) {
      failures.push(`${file} contains a public key field`);
    }
  } catch (error) {
    failures.push(`${file} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

for (const file of criticalTextFiles) {
  if (!fs.existsSync(path.join(root, file))) continue;
  const text = read(file);
  const badPattern = mojibakePatterns.find((pattern) => pattern.test(text));
  if (badPattern) {
    failures.push(`${file} contains suspicious text: ${badPattern}`);
  } else {
    console.log(`TEXT OK: ${file}`);
  }
}

for (const check of interfaceChecks) {
  const fullPath = path.join(root, check.file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${check.file} is missing`);
    continue;
  }
  const text = fs.readFileSync(fullPath, 'utf8');
  const missing = check.required.filter((marker) => !text.includes(marker));
  const stale = check.forbidden.filter((marker) => text.includes(marker));
  if (missing.length) failures.push(`${check.file} is missing interface markers: ${missing.join(', ')}`);
  if (stale.length) failures.push(`${check.file} still contains stale markers: ${stale.join(', ')}`);
  if (!missing.length && !stale.length) console.log(`INTERFACE OK: ${check.file}`);
}

try {
  const packageJson = JSON.parse(read('package.json'));
  const declaredDependencies = new Set([
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
    ...Object.keys(packageJson.optionalDependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {}),
  ]);
  const missingImports = new Map();
  for (const scanRoot of dependencyScanRoots) {
    for (const file of walkFiles(scanRoot)) {
      const imports = collectDependencyImports(read(file));
      for (const packageName of imports) {
        if (declaredDependencies.has(packageName)) continue;
        if (!missingImports.has(packageName)) missingImports.set(packageName, []);
        missingImports.get(packageName).push(file);
      }
    }
  }
  if (missingImports.size) {
    for (const [packageName, files] of missingImports) {
      failures.push(`Package "${packageName}" is imported but missing from package.json: ${files.slice(0, 5).join(', ')}`);
    }
  } else {
    console.log('DEPENDENCY OK: imported packages are declared in package.json');
  }
} catch (error) {
  failures.push(`Dependency scan failed: ${error instanceof Error ? error.message : String(error)}`);
}

if (failures.length) {
  console.error('\nHealth check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('\nHealth check passed.');


