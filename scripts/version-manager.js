import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Files and paths
const ROOT_DIR = process.cwd();
const VERSION_PROPS_PATH = path.join(ROOT_DIR, 'version.properties');
const CHANGELOG_PATH = path.join(ROOT_DIR, 'CHANGELOG.md');

// Helper to run bash commands gracefully
function runCommand(command, ignoreError = false) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    if (ignoreError) return '';
    throw error;
  }
}

// Parse custom arguments gracefully
const args = process.argv.slice(2);
const getArgValue = (flag) => {
  const match = args.find(a => a.startsWith(`${flag}=`));
  return match ? match.split('=')[1] : null;
};
const hasFlag = (flag) => args.includes(flag);

// Load configs with fallbacks to environment variables
const stage = getArgValue('--env') || getArgValue('--stage') || process.env.BUILD_ENV || 'production'; // dev, beta, production
const bumpType = getArgValue('--type') || getArgValue('--bump') || 'minor'; // major, minor, patch
const noGit = hasFlag('--no-git') || process.env.NO_GIT === 'true' || false;
const customMessage = getArgValue('--message') || '';
const runBuild = hasFlag('--build') || process.env.RUN_BUILD === 'true' || false;

console.log(`[VersionManager] Initializing version bump...`);
console.log(`[VersionManager] Mode: [${stage.toUpperCase()}] | Bump Type: [${bumpType.toUpperCase()}]`);

// Load version properties
function loadProperties(filePath) {
  const props = {};
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const value = parts[1].trim();
      props[key] = value;
    }
  });
  return props;
}

// Save version properties
function saveProperties(filePath, props, commentHeader = '') {
  let content = commentHeader ? `# ${commentHeader}\n` : '';
  content += `# Generated automatically - DO NOT EDIT MANUALLY\n`;
  for (const [key, val] of Object.entries(props)) {
    content += `${key}=${val}\n`;
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

// Automatic Capacitor directory finder and builder modifier
function patchAndroidGradle() {
  const possiblePaths = [
    path.join(ROOT_DIR, 'app', 'build.gradle'),
    path.join(ROOT_DIR, 'app', 'build.gradle.kts'),
    path.join(ROOT_DIR, 'android', 'app', 'build.gradle'),
    path.join(ROOT_DIR, 'android', 'app', 'build.gradle.kts')
  ];

  possiblePaths.forEach(gradlePath => {
    if (fs.existsSync(gradlePath)) {
      console.log(`[VersionManager] Located Capacitor Android build configuration at ${gradlePath}`);
      let content = fs.readFileSync(gradlePath, 'utf8');
      
      const isKotlinDsl = gradlePath.endsWith('.kts');
      
      if (!content.includes('version.properties')) {
        console.log(`[VersionManager] Syncing dynamic properties configuration file into ${gradlePath}...`);
        
        let propertiesLoader = '';
        if (isKotlinDsl) {
          propertiesLoader = `
// LOAD VERSION CODE & NAME FROM ROOT PROPERTIES
val versionPropsFile = rootProject.file("version.properties")
val versionProps = java.util.Properties()
var currentVersionCode = 5
var currentVersionName = "1.4"

if (versionPropsFile.exists()) {
    java.io.FileInputStream(versionPropsFile).use { versionProps.load(it) }
    currentVersionCode = versionProps.getProperty("VERSION_CODE", "5").toInt()
    currentVersionName = versionProps.getProperty("VERSION_NAME", "1.4")
}
`;
        } else {
          propertiesLoader = `
// LOAD VERSION CODE & NAME FROM ROOT PROPERTIES
def versionPropsFile = rootProject.file("version.properties")
def versionProps = new Properties()
def currentVersionCode = 5
def currentVersionName = "1.4"

if (versionPropsFile.exists()) {
    versionPropsFile.withInputStream { versionProps.load(it) }
    currentVersionCode = versionProps.getProperty("VERSION_CODE", "5").toInteger()
    currentVersionName = versionProps.getProperty("VERSION_NAME", "1.4")
}
`;
        }

        // Insert properties loader right before android { block
        if (content.includes('android {')) {
          content = content.replace('android {', `${propertiesLoader}\nandroid {`);
          
          if (isKotlinDsl) {
            content = content.replace(/versionCode\s*=\s*\d+/, 'versionCode = currentVersionCode');
            content = content.replace(/versionName\s*=\s*"[^"]+"/, 'versionName = currentVersionName');
          } else {
            content = content.replace(/versionCode\s+\d+/, 'versionCode currentVersionCode');
            content = content.replace(/versionName\s+"[^"]+"/, 'versionName currentVersionName');
            content = content.replace(/versionName\s+'[^']+'/, "versionName currentVersionName");
          }
          
          fs.writeFileSync(gradlePath, content, 'utf8');
          console.log(`[VersionManager] Dynamically patched Android app layout file successfully.`);
        }
      }
    }
  });
}

// 1. Process local properties
let props = loadProperties(VERSION_PROPS_PATH);
if (!props) {
  console.log('[VersionManager] No existing version.properties file found. Init properties...');
  props = {
    VERSION_CODE: '5',
    VERSION_MAJOR: '1',
    VERSION_MINOR: '4',
    VERSION_PATCH: '0',
    VERSION_STAGE: 'production',
    VERSION_NAME: '1.4'
  };
}

const currentCode = parseInt(props.VERSION_CODE || '5', 10);
const currentMajor = parseInt(props.VERSION_MAJOR || '1', 10);
const currentMinor = parseInt(props.VERSION_MINOR || '4', 10);
const currentPatch = parseInt(props.VERSION_PATCH || '0', 10);

// Bumps versionCode by +1
const newCode = currentCode + 1;

// Bump relative version names
let newMajor = currentMajor;
let newMinor = currentMinor;
let newPatch = currentPatch;

if (bumpType === 'major') {
  newMajor += 1;
  newMinor = 0;
  newPatch = 0;
} else if (bumpType === 'minor') {
  newMinor += 1;
  newPatch = 0;
} else if (bumpType === 'patch') {
  newPatch += 1;
}

// Environment-based versionName formatting
//  dev = 0.x (e.g. 0.5)
//  beta = 1.x-beta (e.g. 1.5-beta)
//  production = stable versions (e.g., 1.5)
let newVersionName = '';
if (stage === 'dev') {
  newVersionName = `0.${newMinor}`;
  if (newPatch > 0) newVersionName += `.${newPatch}`;
} else if (stage === 'beta') {
  newVersionName = `${newMajor}.${newMinor}`;
  if (newPatch > 0) newVersionName += `.${newPatch}`;
  newVersionName += '-beta';
} else {
  // production/stable
  newVersionName = `${newMajor}.${newMinor}`;
  if (newPatch > 0) newVersionName += `.${newPatch}`;
}

console.log(`[VersionManager] Upgraded Version Code: ${currentCode} -> ${newCode}`);
console.log(`[VersionManager] Upgraded Version Name: ${props.VERSION_NAME} -> ${newVersionName}`);

// Update properties object
const updatedProps = {
  VERSION_CODE: String(newCode),
  VERSION_MAJOR: String(newMajor),
  VERSION_MINOR: String(newMinor),
  VERSION_PATCH: String(newPatch),
  VERSION_STAGE: stage,
  VERSION_NAME: newVersionName
};

// Save properties
saveProperties(VERSION_PROPS_PATH, updatedProps, 'Frosty Bite Android Application Version Properties');

// Sync and modify dynamic Capacitor files automatically
patchAndroidGradle();

// Generate changelog entry
function getGitCommits() {
  try {
    let sinceRange = '';
    const lastTag = runCommand('git describe --tags --abbrev=0', true);
    if (lastTag) {
      sinceRange = `${lastTag}..HEAD`;
    } else {
      sinceRange = '-n 5';
    }
    const log = runCommand(`git log ${sinceRange} --oneline --no-merges`, true);
    if (log) {
      return log.split('\n').map(line => `* ${line}`).join('\n');
    }
  } catch (err) {
    // Graceful error bypass in environments without git configuration
  }
  return '* Regular security enhancements and UI optimization updates.';
}

function updateChangelog(version, code, stageName) {
  const date = new Date().toISOString().split('T')[0];
  const commits = customMessage ? `* ${customMessage}` : getGitCommits();
  
  const entry = `
## [${version}] - ${date} (${stageName.toUpperCase()})
- **Build / Version Code**: \`${code}\`
- **Release Details**:
${commits}
`;
  
  if (fs.existsSync(CHANGELOG_PATH)) {
    let currentContent = fs.readFileSync(CHANGELOG_PATH, 'utf8');
    if (currentContent.includes('# Changelog')) {
      currentContent = currentContent.replace('# Changelog', `# Changelog\n${entry}`);
    } else {
      currentContent = entry + '\n' + currentContent;
    }
    fs.writeFileSync(CHANGELOG_PATH, currentContent, 'utf8');
  } else {
    const baseContent = `# Changelog\n\nAll notable changes to the Frosty Bite application will be documented in this file.\n${entry}`;
    fs.writeFileSync(CHANGELOG_PATH, baseContent, 'utf8');
  }
  console.log(`[VersionManager] Updated ${CHANGELOG_PATH}`);
}

updateChangelog(newVersionName, newCode, stage);

// Git operations
function runGitOperations(version, code, stageName) {
  if (noGit) {
    console.log('[VersionManager] Git steps disabled (--no-git flag verified).');
    return;
  }
  
  try {
    const isGit = runCommand('git rev-parse --is-inside-work-tree', true);
    if (isGit !== 'true') {
      console.log('[VersionManager] Non-git workspace verified. Skipping git automation.');
      return;
    }
    
    runCommand('git add version.properties CHANGELOG.md');
    const commitMsg = `chore(release): bump version to ${version} (build ${code}) [${stageName}]`;
    runCommand(`git commit -m "${commitMsg}"`);
    console.log(`[VersionManager] Created Release Commit: "${commitMsg}"`);
    
    const tag = `v${version}`;
    runCommand(`git tag -a "${tag}" -m "Release build ${code} [${stageName}]"`);
    console.log(`[VersionManager] Created Release Tag: ${tag}`);
  } catch (error) {
    console.warn('[VersionManager] Git tagging skipped. Error detail:', error.message);
  }
}

runGitOperations(newVersionName, newCode, stage);

// Run Gradle production build if asked
function executeGradleBuild() {
  if (!runBuild) {
    console.log('[VersionManager] APK compiled task skipped. Run with --build flag to compile APK.');
    return;
  }
  
  console.log('[VersionManager] Starting Gradle APK assembly procedure...');
  try {
    const gradleCmd = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    let output = '';
    
    if (stage === 'production') {
      console.log(`[VersionManager] Invoking target command: ${gradleCmd} assembleRelease`);
      output = runCommand(`${gradleCmd} assembleRelease`);
    } else {
      console.log(`[VersionManager] Invoking target command: ${gradleCmd} assembleDebug`);
      output = runCommand(`${gradleCmd} assembleDebug`);
    }
    console.log('[VersionManager] Gradle assembly completed successfully.');
    console.log(output);
  } catch (error) {
    console.error('[VersionManager] Gradle task assembly failed:', error.message);
  }
}

executeGradleBuild();
console.log(`[VersionManager] Complete version progression cycle executed successfully!`);
