// Entry for `node --test tools/`: Node 24 runs a directory argument as a module
// (this file) instead of searching it, so load every tools/*.test.mjs from here.
import { readdirSync } from 'node:fs'

const dir = new URL('./', import.meta.url)
for (const name of readdirSync(dir).filter((n) => n.endsWith('.test.mjs')).sort()) await import(new URL(name, dir))
