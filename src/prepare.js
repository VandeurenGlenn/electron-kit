import { mkdirSync } from 'fs'
import { join, sep } from 'path'

const tryMake = async (path) => {
  try {
    return mkdirSync(path)
  } catch (e) {
    // exists (expected behavior)
  }
}

const setupBuildDir = async buildPath => tryMake(buildPath)

const setupAppDir = async (appPath, dirs) => {
  for (const dir of dirs) {
    appPath = join(appPath, dir)
    await tryMake(appPath)
  }
}

export default async (outputPath, platformPath, cwd) => {
  outputPath = join(cwd, outputPath)
  await setupBuildDir(outputPath)
  await setupAppDir(outputPath, platformPath.split('/'))

  return {
    platformPath,
    outputPath
  }
  // await tryMake(output)
}
