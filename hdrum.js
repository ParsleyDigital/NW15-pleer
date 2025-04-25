const $ = jQuery, $win = $(window);

import lamejs from './lame.min.js'
const { Mp3Encoder } = lamejs;

const notes = [];
// Глобальная переменная с текущей папкой нот:
let currentNotesPath = 'notes/';

const ctx = new AudioContext();

// Активируем AudioContext после первого клика пользователя
document.addEventListener('click', function activateAudioContext() {
  if (ctx.state !== 'running') {
    ctx.resume().then(() => {
      console.log('AudioContext resumed after user gesture.');
    });
  }
  document.removeEventListener('click', activateAudioContext);
});

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
  const gain = new GainNode(context, { gain: i == 6 ? .25 : .35 });
  //gain.connect(context.destination);

  if (i) source.connect(gain).connect(context.limiter);
  else source.connect(context.destination);

  if (note.source?.context == context) {
    const { gain } = note.gain;
    const t = (context.currentTime || time) + .03;
    if (time) gain.setValueAtTime(gain.value, time);
    gain.linearRampToValueAtTime(0, t);
    note.source.stop(t);
  }

  Object.assign(note, { source, gain });

  source.start(time);
  $(source).on('ended', e => {
    source.disconnect();
    gain.disconnect();

    if (note.source == source) delete note.source;
  });
}

async function saveRecord(track, name = 'kosmosky') {

  const silence = .1, bitRate = 48000,
    duration = track.reduce((dur, item) => {
      const [note, time] = item.split(':');
      return Math.max(dur, time / 1000 + notes[note].buffer.duration);
    }, 0) + silence;

  const offlineCtx = new OfflineAudioContext(1, bitRate * duration, bitRate);
  addCompressor(offlineCtx);

  const encoder = new Mp3Encoder(1, bitRate, 128);

  track.forEach(item => {
    const [note, time] = item.split(':');
    playBuffer(notes[note], time / 1000 + silence, offlineCtx);
  });

  offlineCtx.startRendering().then((buffer) => {
    //playBuffer({buffer})
    let data = buffer.getChannelData(0);

    const max = data.reduce((max, el) => Math.max(max, Math.abs(el)), 0);
    data.forEach((d, i) => data[i] = d * 32767 / max);

    const chunks = [];
    setTimeout(async function encode() {
      if (data.length) {
        setTimeout(encode);
        chunks.push(encoder.encodeBuffer(data.subarray(0, 11520)));
        data = data.subarray(11520);
      } else {
        chunks.push(encoder.flush());

        var blob = new Blob(chunks, { type: 'audio/mp3' });
        var href = window.URL.createObjectURL(blob);

        jQuery('<a>').prop({ href, download: name + '.mp3' })[0].click();
      }
    });
  });
}

window.saveRecord = saveRecord;

const gamma = [];
for (let i = 0; i < 15; i++) {
  gamma[i] = i + 1 + ':' + i * 500;
}

function url(url) {
  return new URL(url, import.meta.url).href;
};

const container = $('#hdrum-vidget');

if (!container.children()[0]) {
  container.html(await $.get(url('hdrum.html')));
}

function play(note) {
  if (!notes[note]) return;

  const { $petal, timer } = notes[note];

  playBuffer(notes[note]);

  $petal.addClass('active');
  clearTimeout(timer);
  notes[note].timer = setTimeout(() => { $petal.removeClass('active'); }, 100);

  if (recording) record(note);
}

// Запоминаем записи
let startRec;
function record(note) {

  const t = ctx.currentTime * 1000;

  if (!localStorage[recId]) startRec = t;
  else localStorage[recId] += ',';

  localStorage[recId] += `${note}:${Math.round(t - startRec)}`;
}

$('.hd-drum>svg').clone().addClass('hd-drum2').appendTo('.hd-drum')
  .find('filter').remove();

const loading = [];

const keys = '01234567QWERTYUI';
$win.keydown(e => {
  if (e.originalEvent.repeat) return;
  play(keys.indexOf(e.code.at(-1)));
});

// При первоначальной загрузке используем currentNotesPath
const $petals = $('[data-petal]').each((i, el) => {

  if (!$(el).closest('.hd-drum2')[0])
    $('path', el).clone().prependTo(el).addClass('hd-white');

  const note = +el.dataset.petal;
  if (notes[note]) return;

  const $petal = $(`[data-petal="${note}"]`);

  notes[note] = { $petal, i };

  // Используем currentNotesPath вместо захардкоженной "notes/"
  loading.push(
    fetch(url(`${currentNotesPath}${note || 'tuk'}.mp3`))
      .then(res => res.arrayBuffer())
      .then(data => ctx.decodeAudioData(data))
      .then(buffer => notes[note].buffer = buffer)
  );

  $petal.on('pointerdown', function (e) {

    $('.hd-controls button').mouseleave();

    play(note);

    let lastNote = note;

    this.setPointerCapture(e.pointerId);

    $(this).on('pointermove', function (e) {

      const targ = $(document.elementFromPoint(e.clientX, e.clientY)).closest('[data-petal]')[0];
      const note = targ?.dataset.petal;

      if (note == lastNote || !(note > 0)) return;

      $petals.removeClass('hover')
        .find(`[data-petal="${note}"]`).addClass('hover');
      play(note);

      lastNote = note;
    });

  }).on('pointerenter', e => {

    $petal.addClass('hover');

  }).on('pointerleave', e => {

    $petals.removeClass('hover');
  });

}).on('touchstart selectstart', e => e.preventDefault());

$win.on('pointerup pointercancel blur', e => {
  $petals.off('pointermove');
});

Promise.all(loading).then(() => console.log('all notes loaded'));

let recording = 0, start, trackId, track, recId, playing, trackTimers = [];

const $rec = $('.hd-rec').on('click', e => {

  recording ^= 1; // toggle 1-0

  $rec.toggleClass('hd-active');

  //if (recording && playing) $play.click();

  const tracksList = localStorage.hdTracks || '',
    tracksCount = tracksList.split(',').length;

  if (recording) {

    recId = 'hd_record_melody' + tracksCount;
    trackId = '';

    localStorage[recId] = '';

  } else if (localStorage[recId]) {

    localStorage.hdTracks = tracksList + (tracksCount ? ',' : '') + recId;
    setTrack(recId);

  } else {
    delete localStorage[recId];
    setTrack();
  }
});

const $play = $('.hd-play').on('click', e => {

  playing ^= 1;
  $play.toggleClass('hd-active');

  if (playing) {
    if (track == gamma) $gamma.addClass('active');

    trackTimers = [];

    let t0 = timeline.value;

    if (t0 == timeline.max) setTime(t0 = 0);
    start = ctx.currentTime * 1000 - t0;

    track.forEach((el, i, { length }) => {
      let [note, time] = el.split(':');

      time -= t0;

      if (!time) play(note);
      else if (time > 0) trackTimers.push(setTimeout(() => {
        play(note);
        //if (i==length-1 && playing) $play.click()
      }, time));

      if (length == 1) $play.click();
    });
  } else {
    trackTimers.forEach(timer => clearTimeout(timer));
    if (track == gamma && trackId) setTrack();
    $gamma.removeClass('active');
  }

});

function setTrack(id = trackId) {

  if (!id) return;

  if (id != gamma && !(id in localStorage)) {
    console.warn(`melody ${id} does not exist!`);
    return;
  }

  if (id != gamma) trackId = localStorage.lastTrack = id;

  window.curTrack = track = localStorage[id]?.split(',') || gamma;

  timeline.max = +(/\d+$/.exec(track.at(-1))) + 100;
  setTime(0);
  if (track != gamma || $player.is('.hd-visible')) $('.hd-bottom>*').toggleClass('hd-visible');
}

const $player = $('.hd-player');
const $timeline = $('.hd-timeline input')
  .on('input', setTime).prop({ min: 0 });
const timeline = $timeline[0];

function setTime(time) {
  if (!isNaN(time)) timeline.value = Math.min(time, timeline.max);

  const { min, max, value } = timeline;

  if (this == timeline) {
    if (playing && +value + this.lastVal) $play.click().click();
    this.lastVal = +value;
  }

  if (playing && value == max) {
    $play.click();
    if (track == gamma) setTrack();
  }
  timeline.parentNode.style.setProperty('--progress', (value - min) / (max - min) * 100 + '%');
}

const $gamma = $('.hd-gamma').click(function (e) {
  $gamma.addClass('clicked');
  const isG = track == gamma;
  if (playing || isG) $play.click();
  if (isG) return;
  setTrack(gamma);
  $play.click();
}).on('mouseleave', e => $gamma.removeClass('clicked'));

$('.hd-close').click(e => {
  trackId = '';
  $('.hd-bottom>*').toggleClass('hd-visible');
});

//setTrack();

requestAnimationFrame(function fn() {
  requestAnimationFrame(fn);

  if (!playing) return;

  setTime(ctx.currentTime * 1000 - start);
});

const $share = $('.hd-share').click(e => saveRecord(track));

$win.on('blur', e => {
  if (recording) $rec.click();
});

[...'ABDFACEFDBGEC'].forEach((char, i) => {
  $('<b class="hd-tag">' + char
    .replace(/F/g, 'F<sub class="green">#</sub>')
    .replace(/B/g, 'B<sub class="white-drum">♭</sub>')
    .replace(/E/g, 'E<sub class="white-drum">♭</sub>') + '</b>')
    .css({ '--rot': i / 13 + 'turn' })
    .prependTo('.hd-drum');
});
'235791113141210864'.match(/1?./g).forEach((n, i) => {
  $(`<b class="hd-tag-n hd-n${i + 2}">${n}</b>`)
    .prependTo('.hd-drum');
});

// Функция для перезагрузки нот из указанной папки
function reloadNotes(path) {
  currentNotesPath = path;
  const newLoading = [];
  $petals.each((i, el) => {
    const note = +el.dataset.petal;
    newLoading.push(
      fetch(url(`${currentNotesPath}${note || 'tuk'}.mp3`))
        .then(res => res.arrayBuffer())
        .then(data => ctx.decodeAudioData(data))
        .then(buffer => {
          notes[note].buffer = buffer;
        })
    );
  });
  Promise.all(newLoading).then(() => console.log('Notes reloaded from ' + path));
}

// Изменения для переключения наборов нот:
// Обработчик для .white-drum-link – например, будем грузить ноты из папки "notes_white/"
$('.white-drum-link').on('click', function (e) {
  e.preventDefault();

  const vars = {
    '--color': '#AA96BE',
    '--color2': '#AA96BE97',
    '--colorN': '#9068B8',
    '--colorS': '#5D5268',
    '--colorSA': '#c2a5e0',
    '--colorSH': '#9479b08a',
    '--bg': 'url(images/pantam-1505-w.webp)',
    '--white': 'inline',
    '--green': 'none',
    '--drum-active-hover-opacity': '0.8',
    '--drum-original-hover-opacity': '0',
    '--filter': 'url(./#hd-glow-white)',
    '--strokeWidthSA': '0.5px'
  };

  $('.green-drum-link__active').removeClass('green-drum-link__active');
  $('.white-drum-link').addClass('white-drum-link__active');

  const root = document.documentElement;
  $.each(vars, function (key, value) {
    root.style.setProperty(key, value);
  });

  // Переключаем набор нот на "notes_white/" и перезагружаем аудиофайлы
  reloadNotes('notes_white/');
});

// Обработчик для .green-drum-link – грузим ноты из папки "notes/"
$('.green-drum-link').on('click', function (e) {
  e.preventDefault();

  const vars = {
    '--color': '#70a8a9',
    '--color2': '#70a8a997',
    '--colorN': '#fff',
    '--colorS': '#000',
    '--colorSA': '#fffffd',
    '--colorSH': '#ABBEBD',
    '--bg': 'url(images/pantam-1505.webp)',
    '--white': 'none',
    '--green': 'inline',
    '--drum-active-hover-opacity': '0.8',
    '--drum-original-hover-opacity': '0',
    '--filter': 'url(./#hd-glow)',
    '--strokeWidthSA': '1.5px'
  };

  $('.white-drum-link__active').removeClass('white-drum-link__active');
  $('.green-drum-link').addClass('green-drum-link__active');

  const root = document.documentElement;
  $.each(vars, function (key, value) {
    root.style.setProperty(key, value);
  });

  // Переключаем набор нот на "notes/" и перезагружаем аудиофайлы
  reloadNotes('notes/');
});