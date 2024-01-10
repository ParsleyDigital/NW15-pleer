const $ = jQuery, $win = $(window);

import { ctx, playBuffer, saveRecord, notes } from './audio_utils.js'

const gamma = []
for (let i = 0; i < 15; i++) {
  gamma[i] = i + 1 + ':' + i * 500
}
console.log(gamma);

function url(url) {
  return new URL(url, import.meta.url).href
};

const container = $('#hdrum-vidget')

if (!container.children()[0]) {
  container.html(await $.get(url('hdrum.html')));
}

function play(note) {
  if (!notes[note]) return;

  const { $petal, timer } = notes[note];

  playBuffer(notes[note]);

  $petal.addClass('active');
  clearTimeout(timer);
  notes[note].timer = setTimeout(() => { $petal.removeClass('active') }, 100)

  if (recording) record(note)
}


// function play(note) {
//   if (!notes[note]) return;

//   const { $petal, timer } = notes[note];

//   Object.values(notes).forEach(otherNote => {
//     if (otherNote !== notes[note]) {
//       otherNote.$petal.removeClass('active');
//       clearTimeout(otherNote.timer);
//     }
//   });

//   playBuffer(notes[note]);

//   $petal.addClass('active');
//   clearTimeout(timer);
//   notes[note].timer = setTimeout(() => { $petal.removeClass('active') }, 350)

//   if (recording) record(note);
// }



let startRec;
function record(note) {

  const t = ctx.currentTime * 1000

  if (!localStorage[recId]) startRec = t
  else localStorage[recId] += ',';

  localStorage[recId] += `${note}:${Math.round(t - startRec)}`;
}

$('.hd-drum>svg').clone().addClass('hd-drum2').appendTo('.hd-drum')
  .find('filter').remove();

const loading = [];

const keys = '0123456789QWERTY';
$win.keydown(e => {
  if (e.originalEvent.repeat) return;
  play(keys.indexOf(e.code.at(-1)))
})

const $petals = $('[data-petal]').each((i, el) => {

  if (!$(el).closest('.hd-drum2')[0])
    $('path', el).clone().prependTo(el).addClass('hd-white');

  const note = +el.dataset.petal
  if (notes[note]) return;

  const $petal = $(`[data-petal="${note}"]`);

  notes[note] = { $petal, i };

  loading.push(
    fetch(url(`notes/${note || 'tuk'}.mp3`))
      .then(res => res.arrayBuffer())
      .then(data => ctx.decodeAudioData(data))
      .then(buffer => notes[note].buffer = buffer)
  );

  $petal.on('pointerdown', function (e) {

    $('.hd-controls button').mouseleave();

    play(note);

    let lastNote = note;

    this.setPointerCapture(e.pointerId)

    $(this).on('pointermove', function (e) {

      const targ = $(document.elementFromPoint(e.clientX, e.clientY)).closest('[data-petal]')[0];
      const note = targ?.dataset.petal;

      if (note == lastNote || !(note > 0)) return;

      $petals.removeClass('hover')
        .find(`[data-petal="${note}"]`).addClass('hover');
      play(note);

      lastNote = note;
    })

  }).on('pointerenter', e => {

    $petal.addClass('hover');

  }).on('pointerleave', e => {

    $petals.removeClass('hover')
  })

}).on('touchstart selectstart', e => e.preventDefault());

$win.on('pointerup pointercancel blur', e => {
  //console.log(e.type)
  $petals.off('pointermove')
})

Promise.all(loading).then(() => console.log('all notes loaded'))

let recording = 0, start, trackId, track, recId, playing, trackTimers = [];

const $rec = $('.hd-rec').on('click', e => {

  recording ^= 1; // toggle 1-0

  $rec.toggleClass('hd-active')

  //if (recording && playing) $play.click();

  const tracksList = localStorage.hdTracks || '',
    tracksCount = tracksList.split(',').length;

  if (recording) {

    recId = 'hd_record_melody' + tracksCount;
    trackId = '';

    localStorage[recId] = ''

  } else if (localStorage[recId]) {

    localStorage.hdTracks = tracksList + (tracksCount ? ',' : '') + recId;
    setTrack(recId);

  } else {
    delete localStorage[recId];
    setTrack()
  }
})

const $play = $('.hd-play').on('click', e => {

  playing ^= 1;
  $play.toggleClass('hd-active');

  if (playing) {
    if (track == gamma) $gamma.addClass('active');

    trackTimers = [];

    let t0 = timeline.value

    if (t0 == timeline.max) setTime(t0 = 0);
    start = ctx.currentTime * 1000 - t0;

    track.forEach((el, i, { length }) => {
      let [note, time] = el.split(':')

      time -= t0;

      if (!time) play(note)
      else if (time > 0) trackTimers.push(setTimeout(() => {
        play(note);
        //if (i==length-1 && playing) $play.click()
      }, time))

      if (length == 1) $play.click()
    })
  } else {
    trackTimers.forEach(timer => clearTimeout(timer))
    if (track == gamma && trackId) setTrack();
    $gamma.removeClass('active');
  }

})

function setTrack(id = trackId) {

  if (!id) return;

  if (id != gamma && !(id in localStorage)) {
    console.warn(`melody ${id} does not exist!`);
    return;
  }

  if (id != gamma) trackId = localStorage.lastTrack = id;

  window.curTrack = track = localStorage[id]?.split(',') || gamma;

  timeline.max = +(/\d+$/.exec(track.at(-1))) + 100
  setTime(0);
  if (track != gamma || $player.is('.hd-visible')) $('.hd-bottom>*').toggleClass('hd-visible');
}

const $player = $('.hd-player');
const $timeline = $('.hd-timeline input')
  .on('input', setTime).prop({ min: 0 })
const timeline = $timeline[0];

//console.log($timeline);
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
  timeline.parentNode.style.setProperty('--progress', (value - min) / (max - min) * 100 + '%')
}

const $gamma = $('.hd-gamma').click(function (e) {
  $gamma.addClass('clicked');
  const isG = track == gamma;
  if (playing || isG) $play.click();
  if (isG) return;
  setTrack(gamma);
  $play.click();
}).on('mouseleave', e => $gamma.removeClass('clicked'))

$('.hd-close').click(e => {
  trackId = '';
  $('.hd-bottom>*').toggleClass('hd-visible')
})

//setTrack();

requestAnimationFrame(function fn() {
  requestAnimationFrame(fn);

  if (!playing) return;

  setTime(ctx.currentTime * 1000 - start);
})

const $share = $('.hd-share').click(e => saveRecord(track))

$win.on('blur', e => {
  if (recording) $rec.click()
});

[...'ABDFACEFDBGEC'].forEach((char, i) => {
  $('<b class="hd-tag">' + char.replace(/F/g, 'F<sub>#</sub>') + '</b>').css({
    '--rot': i / 13 + 'turn'
  }).prependTo('.hd-drum')
})
'235791113141210864'.match(/1?./g).forEach((n, i) => {
  $(`<b class="hd-tag-n hd-n${i + 2}">${n}</b>`)
    .prependTo('.hd-drum')
})

console.log(`11`)