import kit from './kit'
import { join } from 'path'

const pack = require(join(process.cwd(), 'package.json'))

kit(pack || {})
