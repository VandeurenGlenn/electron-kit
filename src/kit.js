import { platform } from 'os'
import { renameSync } from 'fs'
import { execFile } from 'node:child_process'
import { createPackage } from 'asar'
import prepare from './prepare'
import { posix } from 'path'
import rcedit from 'rcedit'
import { createWindowsInstaller } from 'electron-winstaller'
import ora from 'ora';
import createDMG from 'electron-installer-dmg'
import { promisify } from 'node:util'

const exec = promisify(execFile)

const { join } = posix
const spinner = ora('loading electron-kit').start();

// macOs
const macPatch = `electron/Electron.app/Contents/Resources`
// Linux & Windows
const win32Path = `electron/resources`

const defaultOptions = {
  // where the result will be stored
  output: 'build',
  // where to get the files to bundle (note app needs to be bundled already or iow everything needed needs to be there)
  input: 'app',
  asar: true
}

const safeRM = (path) => exec('rm', ['-rf', path])
const safeCP = (from, to) => exec('cp', ['-r', from, to])
const safeInstall = (options) => exec(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', ['i'], options)

const clean = async path => {
  try {
    await safeRM(path)
  } catch (e) {
    // nothing to cleanup
    // better to exec then waste checking if it exists
  }
  return
}

const getPlatformPath = (os, asar, name) => {
  let platformPath = os === 'darwin' ? macPatch : win32Path
  // if (name) platformPath = platformPath.replace('Electron.app', `${name}.app`)
  return asar ? platformPath : join(platformPath, 'app')
}

export default async (options = {}) => {
  options = { ...defaultOptions, ...options }
  // TODO: add cwd and platform to options?
  const cwd = process.cwd()
  const os = platform()
  const platformPath = getPlatformPath(os, options.asar, options.productName)
  const electronPath = join(cwd, options.output, 'unpacked', 'electron')

  spinner.text = 'cleaning'
  await clean(options.output)

  spinner.text = 'creating directories'
  await prepare(options.output, join('unpacked', platformPath), cwd)

  spinner.text = 'copying electron binaries'
  await safeCP(join(cwd, 'node_modules', 'electron', 'dist', '**'), electronPath)
  
  try {
    spinner.text = 'installing npm dependencies'
    const pack = require(join(cwd, options.input, 'package.json'))
    await safeInstall({cwd: join(cwd, options.input)})
  } catch (e) {
    spinner.warn('no package.json, not using dependencies?');
  }
  if (options.asar) {
    spinner.text = 'creating asar archive'
    await createPackage(join(cwd, options.input), join(cwd, '.temp-electron-kit', 'app.asar'))

    await safeCP(join(cwd, '.temp-electron-kit', 'app.asar'), join(cwd, options.output, 'unpacked', platformPath))
  } else {
    spinner.text = 'copying app files'
    await safeCP(join(cwd, options.input, '**'), join(cwd, options.output, 'unpacked', platformPath))
  }

  if (options.productName) {
// rename the CFBundleDisplayName, CFBundleIdentifier and CFBundleName fields in the following files:
//
// Electron.app/Contents/Info.plist
// Electron.app/Contents/Frameworks/Electron Helper.app/Contents/Info.plist
  spinner.text = 'rebranding'
    if (os === 'darwin') {
      // renameSync(join(electronPath, 'Electron.app'), join(electronPath, `${options.productName}.app`))
    } else if (os === 'win32') {
      renameSync(join(electronPath, 'electron.exe'), join(electronPath, `${options.productName}.exe`))
      // permission: asInvoker, highestAvailable, or requireAdministrator.
      await rcedit(join(electronPath, `${options.productName}.exe`), {
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
      })
    } else if (os === 'linux') {
      renameSync(join(electronPath, 'electron'), join(electronPath, `${options.productName}`))
    }
  }
  spinner.text = 'cleaning build'
  await clean(join(cwd, options.output, 'unpacked', platformPath, 'default_app.asar'))
  await clean(join(cwd, '.temp-electron-kit'))

  spinner.text = 'creating setup'
  if (os === 'win32') {
    try {
      await createWindowsInstaller({
        appDirectory: join(cwd, options.output, 'unpacked', 'electron'),
        outputDirectory: join(cwd, options.output),
        authors: options.company,
        name: options.productName.replace(/\s+/g, ''),
        exe: `${options.productName || 'electron'}.exe`
      });
      spinner.succeed('electron-kit done')
    } catch (e) {
      spinner.fail(`${e.message}`);
    }
  } if (os === 'darwin') {
    await createDMG({
      appPath: join(cwd, options.output, 'unpacked', 'electron', 'Electron.app'),
      name: options.productName.replace(/\s+/g, ''),
      out: join(cwd, options.output)
    })
    // createMacInstaller()
  }

  if (os === 'linux') {

  }
}
