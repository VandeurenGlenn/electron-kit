#!/usr/bin/env node
'use strict';

var os = require('os');
var fs = require('fs');
var child_process = require('child_process');
var asar = require('asar');
var path = require('path');
var rcedit = require('rcedit');
var electronWinstaller = require('electron-winstaller');
var ora = require('ora');
var createDMG = require('electron-installer-dmg');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var rcedit__default = /*#__PURE__*/_interopDefaultLegacy(rcedit);
var ora__default = /*#__PURE__*/_interopDefaultLegacy(ora);
var createDMG__default = /*#__PURE__*/_interopDefaultLegacy(createDMG);

const tryMake = async (path) => {
  try {
    return fs.mkdirSync(path)
  } catch (e) {
    // exists (expected behavior)
  }
};

const setupBuildDir = async buildPath => tryMake(buildPath);

const setupAppDir = async (appPath, dirs) => {
  for (const dir of dirs) {
    appPath = path.join(appPath, dir);
    await tryMake(appPath);
  }
};

var prepare = async (outputPath, platformPath, cwd) => {
  outputPath = path.join(cwd, outputPath);
  await setupBuildDir(outputPath);
  await setupAppDir(outputPath, platformPath.split('/'));

  return {
    platformPath,
    outputPath
  }
  // await tryMake(output)
};

const { join } = path.posix;
const spinner = ora__default["default"]('loading electron-kit').start();

// macOs
const macPatch = `electron/Electron.app/Contents/Resources`;
// Linux & Windows
const win32Path = `electron/resources`;

const defaultOptions = {
  // where the result will be stored
  output: 'build',
  // where to get the files to bundle (note app needs to be bundled already or iow everything needed needs to be there)
  input: 'app',
  asar: true
};

const clean = async path => {
  try {
    child_process.execSync(`rm -rf ${path}`);
  } catch (e) {
    // nothing to cleanup
    // better to exec then waste checking if it exists
  }
  return
};

const getPlatformPath = (os, asar, name) => {
  let platformPath = os === 'darwin' ? macPatch : win32Path;
  // if (name) platformPath = platformPath.replace('Electron.app', `${name}.app`)
  return asar ? platformPath : join(platformPath, 'app')
};

var kit = async (options = {}) => {
  options = { ...defaultOptions, ...options };
  // TODO: add cwd and platform to options?
  const cwd = process.cwd();
  const os$1 = os.platform();
  const platformPath = getPlatformPath(os$1, options.asar, options.productName);
  const electronPath = join(cwd, options.output, 'unpacked', 'electron');

  spinner.text = 'cleaning';
  await clean(options.output);

  spinner.text = 'creating directories';
  await prepare(options.output, join('unpacked', platformPath), cwd);

  spinner.text = 'copying electron binaries';
  child_process.execSync(`cp -r ${join(cwd, 'node_modules', 'electron', 'dist', '**')} ${electronPath}`);

  try {
    spinner.text = 'installing npm dependencies';
    const pack = require(join(cwd, options.input, 'package.json'));
    await child_process.execSync('npm i', {cwd: join(cwd, options.input)});
  } catch (e) {
    spinner.warn('no package.json, not using dependencies?');
  }
  if (options.asar) {
    spinner.text = 'creating asar archive';
    await asar.createPackage(join(cwd, options.input), join(cwd, '.temp-electron-kit', 'app.asar'));
    child_process.execSync(`cp -r ${join(cwd, '.temp-electron-kit', 'app.asar')} ${join(cwd, options.output, 'unpacked', platformPath)}`);
  } else {
    spinner.text = 'copying app files';
    child_process.execSync(`cp -r ${join(cwd, options.input, '**')} ${join(cwd, options.output, 'unpacked', platformPath)}`);
  }

  if (options.productName) {
// rename the CFBundleDisplayName, CFBundleIdentifier and CFBundleName fields in the following files:
//
// Electron.app/Contents/Info.plist
// Electron.app/Contents/Frameworks/Electron Helper.app/Contents/Info.plist
  spinner.text = 'rebranding';
    if (os$1 === 'darwin') ; else if (os$1 === 'win32') {
      fs.renameSync(join(electronPath, 'electron.exe'), join(electronPath, `${options.productName}.exe`));
      // permission: asInvoker, highestAvailable, or requireAdministrator.
      await rcedit__default["default"](join(electronPath, `${options.productName}.exe`), {
        'version-string': {
          'CompanyName': options.company,
          'LegalCopyright': options.copyright,
          'ProductName': options.productName,
          'ProductVersion': options.version,
          'FileVersion': options.version,
          'FileDescription': options.description || options.company || options.productName
        },
        'product-version': options.version,
        'icon': options.icon,
        'requested-execution-level': options.permission,
        'application-manifest': options.manifest
      });
    } else if (os$1 === 'linux') {
      fs.renameSync(join(electronPath, 'electron'), join(electronPath, `${options.productName}`));
    }
  }
  spinner.text = 'cleaning build';
  await clean(join(cwd, options.output, 'unpacked', platformPath, 'default_app.asar'));
  await clean(join(cwd, '.temp-electron-kit'));

  spinner.text = 'creating setup';
  if (os$1 === 'win32') {
    try {
      await electronWinstaller.createWindowsInstaller({
        appDirectory: join(cwd, options.output, 'unpacked', 'electron'),
        outputDirectory: join(cwd, options.output),
        authors: options.company,
        name: options.productName.replace(/\s+/g, ''),
        exe: `${options.productName || 'electron'}.exe`
      });
      spinner.succeed('electron-kit done');
    } catch (e) {
      spinner.fail(`${e.message}`);
    }
  } if (os$1 === 'darwin') {
    await createDMG__default["default"]({
      appPath: join(cwd, options.output, 'unpacked', 'electron', 'Electron.app'),
      name: options.productName.replace(/\s+/g, ''),
      out: join(cwd, options.output)
    });
    // createMacInstaller()
  }
};

const pack = require(path.join(process.cwd(), 'package.json'));

kit(pack || {});
