export default [{
  input: 'src/cli.js',
  output: {
    dir: 'bin',
    format: 'cjs',
    banner: '#!/usr/bin/env node'
  }
}, {
  input: 'src/kit.js',
  output: {
    dir: 'dist',
    format: 'cjs'
  }
}]
