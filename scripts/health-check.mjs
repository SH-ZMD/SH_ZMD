import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const publicJsonFiles = [
  'public/publish-manifest.json',
  'public/life-modules.json',
  'public/key-url-tables.json',
  'public/archive-collections.json',
  'public/music-data.json',
];

const criticalTextFiles = [
  'AGENTS.md',
  'components/Navbar.tsx',
  'components/Navbar.public.tsx',
  'components/KeyUrlPublicTable.tsx',
  'components/Comments.tsx',
  'components/settings/CommentSection.tsx',
  'components/settings/LifeModulesSection.tsx',
  'app/settings/page.tsx',
  'app/photowall/page.public.tsx',
  'app/recommendations/page.tsx',
  'app/key-urls/page.tsx',
  'app/share/page.tsx',
  'cms_core/api/sync.py',
  'cms_core/api/key_url_tables.py',
  'cms_core/api/drafts.py',
  'app/api/comments/route.ts',
  'app/api/comment-images/route.ts',
];

const mojibakePatterns = [
  /�/,
  /鍒|绔|涓|澶|褰|鐓|璇|瀵|妫|鏂|鎺|閾|馃|鈽|鉁/,
  /\?\?\?\?/,
  /Key \/ URL 管理表/,
  /Key 与链接/,
];

const publicNavbarFile = fs.existsSync(path.join(root, 'components/Navbar.public.tsx')) ? 'components/Navbar.public.tsx' : 'components/Navbar.tsx';
const publicPhotoWallFile = fs.existsSync(path.join(root, 'app/photowall/page.public.tsx')) ? 'app/photowall/page.public.tsx' : 'app/photowall/page.tsx';
const isManagerSource = fs.existsSync(path.join(root, 'components/Navbar.public.tsx')) || fs.existsSync(path.join(root, 'app/photowall/page.public.tsx'));

const publicRetiredFiles = [
  'app/drafts/page.tsx',
  'app/editor/page.tsx',
  'app/editor/EditorClient.tsx',
  'app/settings/page.tsx',
  'app/api/chat/route.ts',
  'app/api/public-chat/route.ts',
  'app/api/github/route.ts',
  'app/api/local-archive-collections/route.ts',
  'app/api/local-key-url-tables/route.ts',
  'app/api/local-life-modules/route.ts',
  'app/api/test/route.ts',
  'app/api/weather/route.ts',
  'app/photowall/PhotoWallClient.tsx',
  'components/CyberCat.tsx',
  'components/DanmakuBackground.tsx',
  'components/LabComments.tsx',
  'components/LazyCyberCat.tsx',
  'components/LazyDanmakuBackground.tsx',
  'components/PendingOperationsInbox.tsx',
  'components/CommentNotifier.tsx',
  'components/WeatherWidget.tsx',
  'components/WalineComments.tsx',
];

const publicRetiredDirs = [
  'app/drafts',
  'app/editor',
  'app/settings',
  'components/settings',
];

const requiredSyncDirs = ['posts', 'chatters', 'moments', 'public/image', 'public/audio'];

const requiredSyncFiles = [
  '.gitignore',
  'next.config.ts',
  'package.json',
  'package-lock.json',
  'app/about/about.md',
  'app/about/page.tsx',
  'app/api/comments/route.ts',
  'app/api/comment-images/route.ts',
  'app/api/music/resolve/route.ts',
  'app/chatter/ChatterBoard.tsx',
  'app/chatter/[slug]/page.tsx',
  'app/chatter/page.tsx',
  'app/friends/FriendsBoard.tsx',
  'app/friends/page.tsx',
  'app/guestbook/page.tsx',
  'app/key-urls/page.tsx',
  'app/layout.tsx',
  'app/moments/MomentList.tsx',
  'app/moments/page.tsx',
  'app/page.tsx',
  'app/plans/page.tsx',
  'app/photowall/page.tsx',
  'app/posts/[slug]/page.tsx',
  'app/recommendations/page.tsx',
  'app/share/page.tsx',
  'app/starmap/page.tsx',
  'app/timeline/page.tsx',
  'app/tree/page.tsx',
  'components/ArchiveCollectionsClient.tsx',
  'components/Comments.tsx',
  'components/IdleMount.tsx',
  'components/KeyUrlPublicTable.tsx',
  'components/LocalManagerOnly.tsx',
  'components/MusicProvider.tsx',
  'components/Navbar.tsx',
  'context/OperationContext.tsx',
  'lib/localManagerRuntime.ts',
  'scripts/health-check.mjs',
  'public/archive-collections.json',
  'public/key-url-tables.json',
  'public/life-modules.json',
  'public/music-data.json',
  'public/publish-manifest.json',
  'data/albums.ts',
  'data/friends.ts',
  'data/projects.ts',
  'siteConfig.ts',
];

const requiredSyncSourceOverrides = new Map([
  ['app/photowall/page.tsx', 'app/photowall/page.public.tsx'],
  ['components/Navbar.tsx', 'components/Navbar.public.tsx'],
]);

const requiredSourceFileChecks = [
  'app/layout.tsx',
  'components/Navbar.tsx',
  'app/share/page.tsx',
  'app/recommendations/page.tsx',
  'app/key-urls/page.tsx',
  'components/KeyUrlPublicTable.tsx',
  'app/photowall/page.tsx',
  'app/moments/MomentList.tsx',
  'app/chatter/ChatterBoard.tsx',
  'app/friends/FriendsBoard.tsx',
  'app/posts/[slug]/page.tsx',
  'app/chatter/[slug]/page.tsx',
  'app/about/page.tsx',
];

const requiredPublicJsonChecks = [
  'public/publish-manifest.json',
  'public/life-modules.json',
  'public/archive-collections.json',
  'public/key-url-tables.json',
  'public/music-data.json',
];

const requiredOnlinePageChecks = ['/', '/share', '/recommendations'];

const interfaceChecks = [
  {
    file: 'app/layout.tsx',
    required: [],
    forbidden: ['LazyCyberCat', 'LazyDanmakuBackground'],
  },
  {
    file: publicNavbarFile,
    required: ['推荐表', '中转站', '/recommendations', '/key-urls'],
    forbidden: ["{ name: '分享表'", "{ name: '设置'", "{ name: '草稿箱'", '/settings', '/drafts', '/photowall', 'PendingOperationsInbox'],
  },
  {
    file: publicPhotoWallFile,
    required: ['notFound()'],
    forbidden: ['PhotoWallPage', '创建新相册', '添加碎片', 'useOperations'],
  },
  {
    file: 'app/moments/MomentList.tsx',
    required: ['useLocalManagerRuntime', 'canManage && isPublishOpen', 'canManage && deleteConfirmId'],
    forbidden: [],
  },
  {
    file: 'app/chatter/ChatterBoard.tsx',
    required: ['useLocalManagerRuntime', 'canManage && deleteModal.isOpen', 'canManage ? chatters : chatters.filter'],
    forbidden: [],
  },
  {
    file: 'app/friends/FriendsBoard.tsx',
    required: ['useLocalManagerRuntime', 'canManage && friendModal.isOpen', 'canManage && deleteModal.isOpen'],
    forbidden: [],
  },
  {
    file: 'app/posts/[slug]/page.tsx',
    required: ['LocalManagerOnly', 'href={`/editor?id=${postData.slug}&type=post`}'],
    forbidden: [],
  },
  {
    file: 'app/chatter/[slug]/page.tsx',
    required: ['LocalManagerOnly', 'href={`/editor?id=${chatterData.slug}&type=chatter`}'],
    forbidden: [],
  },
  {
    file: 'app/about/page.tsx',
    required: ['LocalManagerOnly', 'href="/editor?type=about"'],
    forbidden: [],
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
  {
    file: 'components/Comments.tsx',
    required: ['评论区', '昵称 *', '邮箱（可选，不公开）', '单条评论最多'],
    forbidden: ['待审核', '审核通过', 'SH_ZMD'],
  },
  {
    file: 'components/settings/CommentSection.tsx',
    required: ['评论和回复会直接发布', '删除', '恢复'],
    forbidden: ['待审核', '审核通过', '垃圾评论', 'SH_ZMD'],
    managerOnly: true,
  },
  {
    file: 'app/api/comments/route.ts',
    required: ['COMMENT_LIMIT_PER_WINDOW', "status: 'published'", 'COMMENT_MARKER'],
    forbidden: ['pending', 'spam', '这个昵称只允许'],
  },
  {
    file: 'app/api/comment-images/route.ts',
    required: ['releases', '不会触发 Vercel', 'MAX_COMMENT_IMAGE_SIZE'],
    forbidden: ['public/comment-images', 'contents/'],
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

function extractAssignedBlock(text, name) {
  const assignmentIndex = text.indexOf(`${name} =`);
  if (assignmentIndex < 0) return null;
  const startCandidates = ['[', '{'].map((char) => {
    const index = text.indexOf(char, assignmentIndex);
    return index < 0 ? Number.POSITIVE_INFINITY : index;
  });
  const start = Math.min(...startCandidates);
  if (!Number.isFinite(start)) return null;
  const opening = text[start];
  const closing = opening === '[' ? ']' : '}';
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === opening) depth += 1;
    if (char === closing) {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function extractPythonStrings(text, name) {
  const block = extractAssignedBlock(text, name);
  if (!block) return null;
  const strings = [];
  const pattern = /["']([^"'\n]+)["']/g;
  let match;
  while ((match = pattern.exec(block))) strings.push(match[1]);
  return strings;
}

function hasPythonMapPair(text, name, key, value) {
  const block = extractAssignedBlock(text, name);
  if (!block) return false;
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`["']${escapedKey}["']\\s*:\\s*["']${escapedValue}["']`).test(block);
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
    if (file.endsWith('publish-manifest.json')) {
      if (data?.kind !== 'blog-publish-manifest') failures.push(`${file} is not a blog publish manifest`);
      if (!data?.fingerprint || typeof data.fingerprint !== 'string') failures.push(`${file} is missing a publish fingerprint`);
      if (!Number.isInteger(data?.entryCount) || data.entryCount <= 0) failures.push(`${file} has an invalid entry count`);
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
  if (check.managerOnly && !isManagerSource) continue;
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

if (isManagerSource) {
  const settingsFile = 'app/settings/page.tsx';
  const settingsText = read(settingsFile);
  const required = ["{ id: 'plans'", "{ id: 'recommendations'", 'mode="plans"', 'mode="recommendations"'];
  const forbidden = [
    'GallerySection',
    'DanmakuSection',
    'KeyUrlSection',
    '图床配置管理',
    '全站弹幕设置',
    '中转站推荐表',
    '计划 / 推荐表',
    "activeTab === 'gallery'",
    "activeTab === 'danmaku'",
    "activeTab === 'keyurl'",
  ];
  const missing = required.filter((marker) => !settingsText.includes(marker));
  const stale = forbidden.filter((marker) => settingsText.includes(marker));
  if (missing.length) failures.push(`${settingsFile} is missing settings split markers: ${missing.join(', ')}`);
  if (stale.length) failures.push(`${settingsFile} still contains removed settings modules: ${stale.join(', ')}`);
  if (!missing.length && !stale.length) console.log(`SETTINGS OK: removed unused settings modules and split plans/recommendations`);

  const syncText = read('cms_core/api/sync.py');
  const syncDirs = extractPythonStrings(syncText, 'SYNC_DIRS');
  const syncFiles = extractPythonStrings(syncText, 'SYNC_FILES');
  const safeRetiredFiles = extractPythonStrings(syncText, 'SAFE_RETIRED_SYNC_FILES');
  const safeRetiredDirs = extractPythonStrings(syncText, 'SAFE_RETIRED_SYNC_DIRS');
  const sourceCheckStrings = extractPythonStrings(syncText, 'SOURCE_FILE_CHECKS');
  const publicJsonCheckStrings = extractPythonStrings(syncText, 'PUBLIC_JSON_CHECKS');
  const onlinePageCheckStrings = extractPythonStrings(syncText, 'ONLINE_PAGE_CHECKS');

  if (!syncDirs) failures.push('cms_core/api/sync.py is missing SYNC_DIRS');
  if (!syncFiles) failures.push('cms_core/api/sync.py is missing SYNC_FILES');
  if (!safeRetiredFiles) failures.push('cms_core/api/sync.py is missing SAFE_RETIRED_SYNC_FILES');
  if (!safeRetiredDirs) failures.push('cms_core/api/sync.py is missing SAFE_RETIRED_SYNC_DIRS');

  if (syncDirs) {
    const missingSyncDirs = requiredSyncDirs.filter((item) => !syncDirs.includes(item));
    if (missingSyncDirs.length) failures.push(`SYNC_DIRS is missing publish directories: ${missingSyncDirs.join(', ')}`);
  }

  if (syncFiles) {
    const missingSyncFiles = requiredSyncFiles.filter((item) => !syncFiles.includes(item));
    const forbiddenSyncedFiles = publicRetiredFiles.filter((item) => syncFiles.includes(item));
    if (missingSyncFiles.length) failures.push(`SYNC_FILES is missing publish files: ${missingSyncFiles.join(', ')}`);
    if (forbiddenSyncedFiles.length) failures.push(`SYNC_FILES includes local-only files: ${forbiddenSyncedFiles.join(', ')}`);
  }

  for (const [publicFile, managerSource] of requiredSyncSourceOverrides) {
    if (!hasPythonMapPair(syncText, 'PUBLIC_SYNC_SOURCE_OVERRIDES', publicFile, managerSource)) {
      failures.push(`PUBLIC_SYNC_SOURCE_OVERRIDES must publish ${publicFile} from ${managerSource}`);
    }
  }

  if (safeRetiredFiles) {
    const missingRetiredFiles = publicRetiredFiles.filter(
      (item) => !safeRetiredFiles.includes(item) && !publicRetiredDirs.some((dir) => item === dir || item.startsWith(`${dir}/`)),
    );
    if (missingRetiredFiles.length) failures.push(`SAFE_RETIRED_SYNC_FILES must clean local-only files: ${missingRetiredFiles.join(', ')}`);
  }

  if (safeRetiredDirs) {
    const missingRetiredDirs = publicRetiredDirs.filter((item) => !safeRetiredDirs.includes(item));
    if (missingRetiredDirs.length) failures.push(`SAFE_RETIRED_SYNC_DIRS must clean local-only directories: ${missingRetiredDirs.join(', ')}`);
  }

  if (sourceCheckStrings) {
    const missingSourceChecks = requiredSourceFileChecks.filter((item) => !sourceCheckStrings.includes(item));
    if (missingSourceChecks.length) failures.push(`SOURCE_FILE_CHECKS is missing public interface checks: ${missingSourceChecks.join(', ')}`);
  }

  if (publicJsonCheckStrings) {
    const missingJsonChecks = requiredPublicJsonChecks.filter((item) => !publicJsonCheckStrings.includes(item));
    if (missingJsonChecks.length) failures.push(`PUBLIC_JSON_CHECKS is missing online data checks: ${missingJsonChecks.join(', ')}`);
  }

  if (onlinePageCheckStrings) {
    const missingPageChecks = requiredOnlinePageChecks.filter((item) => !onlinePageCheckStrings.includes(item));
    if (missingPageChecks.length) failures.push(`ONLINE_PAGE_CHECKS is missing production pages: ${missingPageChecks.join(', ')}`);
  }

  console.log('SYNC COVERAGE OK: publish whitelist, public overrides, online checks, and retired local-only files are guarded');
}

if (!isManagerSource) {
  for (const file of publicRetiredFiles) {
    if (fs.existsSync(path.join(root, file))) {
      failures.push(`${file} is local-only or retired and must not exist in the public site`);
    } else {
      console.log(`PUBLIC BOUNDARY OK: ${file} is absent`);
    }
  }
  for (const dir of publicRetiredDirs) {
    if (fs.existsSync(path.join(root, dir))) {
      failures.push(`${dir} is local-only and must not exist in the public site`);
    } else {
      console.log(`PUBLIC BOUNDARY OK: ${dir} is absent`);
    }
  }
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


