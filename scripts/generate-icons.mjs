// Genera los íconos de la app (favicon, iPhone y Android) a partir de un SVG.
// Uso: npm run icons
import { mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const BRAND = '#0f766e'

// Un recibo blanco con renglones, centrado dentro de la zona segura de los íconos "maskable".
const receipt = `
  <path d="M166 96H346A20 20 0 0 1 366 116V416L329.3 392L292.7 416L256 392L219.3 416L182.7 392L146 416V116A20 20 0 0 1 166 96Z" fill="#ffffff"/>
  <rect x="186" y="160" width="140" height="22" rx="11" fill="${BRAND}" opacity="0.3"/>
  <rect x="186" y="206" width="96" height="22" rx="11" fill="${BRAND}" opacity="0.3"/>
  <rect x="186" y="252" width="140" height="22" rx="11" fill="${BRAND}" opacity="0.3"/>
  <rect x="186" y="316" width="140" height="28" rx="14" fill="${BRAND}"/>`

const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${BRAND}"/>${receipt}</svg>`
const fullBleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${BRAND}"/>${receipt}</svg>`

const toPng = (svg, size, file) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(file)

await mkdir('public/icons', { recursive: true })
await writeFile('src/app/icon.svg', rounded)
await Promise.all([
  toPng(rounded, 192, 'public/icons/icon-192.png'),
  toPng(rounded, 512, 'public/icons/icon-512.png'),
  toPng(fullBleed, 512, 'public/icons/icon-maskable-512.png'),
  toPng(fullBleed, 180, 'src/app/apple-icon.png'),
])

console.log('Íconos generados en public/icons y src/app')
