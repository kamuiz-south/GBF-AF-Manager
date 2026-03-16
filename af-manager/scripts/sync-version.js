import fs from 'fs';
import path from 'path';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const tauriConfPath = 'src-tauri/tauri.conf.json';
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));

if (tauriConf.version !== packageJson.version) {
  console.log(`Syncing Tauri version: ${tauriConf.version} -> ${packageJson.version}`);
  tauriConf.version = packageJson.version;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
} else {
  console.log(`Tauri version is already up to date: ${tauriConf.version}`);
}
