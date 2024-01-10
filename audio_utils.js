import lamejs from './lame.min.js'
const { Mp3Encoder } = lamejs;

const notes = [];

const ctx = new AudioContext();

function addCompressor(ctx0) {

  (ctx0.limiter = new DynamicsCompressorNode(ctx0, {
    ratio: 17,
    knee: 8,
    threshold: ctx == ctx0 ? -16 : -12,
    //attack: 0,
    release: .1,
  }))
    .connect(new GainNode(ctx0, { gain: 1.65 }))
    .connect(ctx0.destination);
}
addCompressor(ctx);

function playBuffer(note, time, context = ctx) {

  if (context == ctx && ctx.state != "running") {
    ctx.resume().then(() => playBuffer(note, time));
    return;
  }
  const { buffer, i } = note;
  const source = new AudioBufferSourceNode(context, { buffer });
  //console.log(i)
  const gain = new GainNode(context, { gain: i == 6 ? .25 : .35 });
  //gain.connect(context.destination);

  if (i) source.connect(gain).connect(context.limiter);
  else source.connect(context.destination)

  if (note.source?.context == context) {
    const { gain } = note.gain;
    const t = (context.currentTime || time) + .03;
    if (time) gain.setValueAtTime(gain.value, time)
    gain.linearRampToValueAtTime(0, t);
    note.source.stop(t)
  }

  Object.assign(note, { source, gain })

  source.start(time);
  $(source).on('ended', e => {
    source.disconnect()
    gain.disconnect()

    if (note.source == source) delete note.source;
    //console.log(source)
  })
}

async function saveRecord(track, name = 'kosmosky') {

  const silence = .1, bitRate = 48000,
    duration = track.reduce((dur, item) => {
      const [note, time] = item.split(':')
      return Math.max(dur, time / 1000 + notes[note].buffer.duration)
    }, 0) + silence

  const offlineCtx = new OfflineAudioContext(1, bitRate * duration, bitRate);
  addCompressor(offlineCtx);

  const encoder = new Mp3Encoder(1, bitRate, 128);

  track.forEach(item => {
    const [note, time] = item.split(':')
    //console.log(time);
    playBuffer(notes[note], time / 1000 + silence, offlineCtx)
  })

  offlineCtx.startRendering().then((buffer) => {
    //playBuffer({buffer})
    let data = buffer.getChannelData(0);

    const max = data.reduce((max, el) => Math.max(max, Math.abs(el)), 0);
    console.log(max);
    data.forEach((d, i) => data[i] = d * 32767 / max);

    const chunks = [];
    setTimeout(async function encode() {
      if (data.length) {
        setTimeout(encode);
        chunks.push(encoder.encodeBuffer(data.subarray(0, 11520)))
        data = data.subarray(11520)
      } else {
        chunks.push(encoder.flush())

        var blob = new Blob(chunks, { type: 'audio/mp3' });
        var href = window.URL.createObjectURL(blob);

        jQuery('<a>').prop({ href, download: name + '.mp3' })[0].click()
      }
    })
  });
  console.log('1start')
}

export { ctx, playBuffer, saveRecord, notes }

window.saveRecord = saveRecord;
