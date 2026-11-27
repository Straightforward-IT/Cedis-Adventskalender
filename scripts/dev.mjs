// Startet Backend und Frontend gemeinsam für die lokale Entwicklung.
import { spawn } from 'node:child_process'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const services = [
  { name: 'backend', color: '\x1b[32m' },
  { name: 'frontend', color: '\x1b[36m' },
]

const children = services.map(({ name, color }) => {
  const child = spawn('npm', ['run', 'dev'], {
    cwd: path.join(root, name),
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  })
  const prefix = `${color}[${name}]\x1b[0m `
  for (const stream of [child.stdout, child.stderr]) {
    let rest = ''
    stream.setEncoding('utf8').on('data', (chunk) => {
      const lines = (rest + chunk).split('\n')
      rest = lines.pop() ?? ''
      for (const line of lines) console.log(prefix + line)
    })
  }
  child.on('exit', (code) => {
    process.exitCode ||= code ?? 0
    stopAll()
  })
  return child
})

function stopAll() {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
  }
}

process.on('SIGINT', stopAll)
process.on('SIGTERM', stopAll)
