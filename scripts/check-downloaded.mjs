import fs from 'node:fs'

const buf = fs.readFileSync('src/assets/image-3562f.png')
console.log('image-3562f.png size:', buf.length)
if (buf.readUInt32BE(0) === 0x89504e47) {
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  console.log('PNG Dimensions:', width, 'x', height)
} else {
  console.log('Not a PNG!')
}
