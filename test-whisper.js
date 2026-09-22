const fs = require('fs');
const whisper = require('whisper-node');

async function test() {
  try {
    // create a dummy wave file (just 44 bytes header)
    const buf = Buffer.alloc(44);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36, 4);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(16000, 24);
    buf.writeUInt32LE(32000, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(0, 40);
    
    fs.writeFileSync('/tmp/test.wav', buf);
    
    console.log("Calling whisper...");
    const res = await whisper.whisper('/tmp/test.wav', { modelName: 'base.en' });
    console.log("Result:", res);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

test();
