// Texture slots mirror the original texture table built at 0x407940 so that
// gameplay code can use the same indices the C++ did (e.g. charId + 7 = Stance).

const CHARACTER_FILES = [
  'attack1', 'attack2', 'attack3', 'attack4', 'block', 'defeat',
  'fatality', 'stance', 'victory', 'walk', 'thumbnail2', 'thumbnail1',
];

export const TEXTURE_FILES = {
  0: 'intro',
  1: 'credits',
  2: 'leftarrow',
  3: 'rightarrow',
  4: 'credits',
  5: 'ucfighter',
  6: 'uclogo',
  7: 'help',
  8: 'paused',
  10: 'leveldata/bar',
  11: 'leveldata/barback',
  13: 'leveldata/fight',
  14: 'leveldata/round1',
  15: 'leveldata/round2',
  16: 'leveldata/round3',
  17: 'leveldata/victory',
  18: 'leveldata/player1',
  19: 'leveldata/player2',
  20: 'leveldata/background1',
  21: 'leveldata/background2',
  22: 'leveldata/background3',
  82: 'playerdata/trev/eski',
  100: 'preloading',
};

for (const [base, name] of [[30, 'rob'], [50, 'geoff'], [70, 'trev']]) {
  CHARACTER_FILES.forEach((file, i) => {
    TEXTURE_FILES[base + i] = `playerdata/${name}/${file}`;
  });
}

export const SOUND_FILES = {
  intro: 'intro.wav',
  round1: 'leveldata/round1.wav',
  round2: 'leveldata/round2.wav',
  round3: 'leveldata/round3.wav',
  fight: 'leveldata/fight.wav',
  awesomeDeath: 'leveldata/awesomedeath.wav',
  hurt: 'playerdata/hurt.wav',
  exert: 'playerdata/excert.wav',
  agony: 'playerdata/agony.wav',
  select: 'leveldata/select.wav',
  selected: 'leveldata/selected.wav',
};

const ASSET_ROOT = 'assets/';

export const textures = {};
export let bloodTexture = null;
export let musicTracks = [];

function loadImage(name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${name}`));
    img.src = `${ASSET_ROOT}${name}.png`;
  });
}

export async function loadPreloadingScreen() {
  textures[100] = await loadImage(TEXTURE_FILES[100]);
}

export async function loadAll(audio, onProgress) {
  const jobs = [];
  for (const [slot, name] of Object.entries(TEXTURE_FILES)) {
    if (textures[slot]) continue;
    jobs.push(loadImage(name).then((img) => { textures[slot] = img; }));
  }
  jobs.push(loadImage('playerdata/blood').then((img) => { bloodTexture = img; }));
  for (const [key, file] of Object.entries(SOUND_FILES)) {
    jobs.push(audio.load(key, ASSET_ROOT + file));
  }
  jobs.push(
    fetch(`${ASSET_ROOT}music/tracks.json`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((list) => { musicTracks = list.map((t) => `${ASSET_ROOT}music/${t}`); }),
  );

  let done = 0;
  await Promise.all(jobs.map((j) => j.then(() => onProgress?.(++done / jobs.length))));
}
