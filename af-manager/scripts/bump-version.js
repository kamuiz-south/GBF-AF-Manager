import fs from 'fs';
import path from 'path';

const newVersion = process.argv[2];

if (!newVersion || !/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(newVersion)) {
  console.error('Error: Invalid version format. Example: 1.0.7');
  console.error('Usage: node bump-version.js <new-version>');
  process.exit(1);
}

console.log(`Bumping version to ${newVersion} ...\n`);

const rootDir = path.resolve(process.cwd(), '../'); // GAproject root
const managerDir = path.join(rootDir, 'af-manager');
const collectorDir = path.join(rootDir, 'af-collector');

const filesToUpdate = [
  {
    path: path.join(managerDir, 'package.json'),
    type: 'json',
    update: (json) => { json.version = newVersion; }
  },
  {
    path: path.join(managerDir, 'src-tauri', 'tauri.conf.json'),
    type: 'json',
    update: (json) => { json.version = newVersion; }
  },
  {
    path: path.join(managerDir, 'src-tauri', 'Cargo.toml'),
    type: 'regex',
    regex: /^version\s*=\s*"[^"]+"/m,
    replace: `version = "${newVersion}"`
  },
  {
    path: path.join(managerDir, 'src', 'App.tsx'),
    type: 'regex',
    regex: /v\{import\.meta\.env\.VITE_APP_VERSION\s*\|\|\s*'[^']+'\}/,
    replace: `v{import.meta.env.VITE_APP_VERSION || '${newVersion}'}`
  },
  {
    path: path.join(collectorDir, 'manifest.json'),
    type: 'json',
    update: (json) => { json.version = newVersion; }
  }
];

let hasError = false;

for (const file of filesToUpdate) {
  if (!fs.existsSync(file.path)) {
    console.warn(`[WARN] File not found, skipping: ${file.path}`);
    continue;
  }

  try {
    const content = fs.readFileSync(file.path, 'utf8');
    let newContent = content;

    if (file.type === 'json') {
      const json = JSON.parse(content);
      file.update(json);
      newContent = JSON.stringify(json, null, 2) + '\n';
    } else if (file.type === 'regex') {
      newContent = content.replace(file.regex, file.replace);
    }

    if (content !== newContent) {
      fs.writeFileSync(file.path, newContent, 'utf8');
      console.log(`[OK] Updated: ${path.relative(rootDir, file.path)}`);
    } else {
      console.log(`[SKIP] No changes needed: ${path.relative(rootDir, file.path)}`);
    }
  } catch (err) {
    console.error(`[ERROR] Failed to update ${file.path}:`, err.message);
    hasError = true;
  }
}

console.log('\nDone.');
process.exit(hasError ? 1 : 0);
