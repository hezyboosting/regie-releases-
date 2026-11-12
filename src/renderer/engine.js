// Fenêtre cachée : voix système, lecture audio du TTS et analyse du son du PC pour l'overlay Spotify.
const { engineOn, engineSend } = window.regie;
let current = null;
let audio = null;

function sendVoices() {
  const voices = speechSynthesis.getVoices().map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang }));
  engineSend('voices', voices);
}
speechSynthesis.onvoiceschanged = sendVoices;
sendVoices();
setTimeout(sendVoices, 1500);

const finished = (id) => { current = null; engineSend('tts-done', { id }); };

engineOn('tts:speak', ({ id, text, voice, rate, pitch, volume }) => {
  const u = new SpeechSynthesisUtterance(text);
  const v = speechSynthesis.getVoices().find((x) => x.voiceURI === voice);
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'fr-FR';
  u.rate = rate || 1;
  u.pitch = pitch || 1;
  u.volume = (volume ?? 80) / 100;
  u.onend = () => finished(id);
  u.onerror = () => finished(id);
  current = u;
  speechSynthesis.speak(u);
});

engineOn('tts:audio', ({ id, url, volume }) => {
  audio = new Audio(url);
  audio.volume = (volume ?? 80) / 100;
  audio.onended = () => finished(id);
  audio.onerror = () => finished(id);
  audio.play().catch(() => finished(id));
});

engineOn('tts:stop', () => {
  speechSynthesis.cancel();
  if (audio) { audio.pause(); audio = null; }
});

engineOn('sound:play', ({ url, volume }) => {
  const a = new Audio(url);
  a.volume = Math.max(0, Math.min(1, (volume ?? 80) / 100));
  a.play().catch(() => {});
});

// Analyse du son du PC (capture « loopback » de Windows). Rien n'est enregistré.
let capture = null;

window.startCapture = async function startCapture() {
  if (capture) return;
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  stream.getVideoTracks().forEach((t) => { t.stop(); stream.removeTrack(t); });
  if (!stream.getAudioTracks().length) return;
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const split = ctx.createChannelSplitter(2);
  const left = ctx.createAnalyser();
  const right = ctx.createAnalyser();
  left.fftSize = 512;
  right.fftSize = 512;
  src.connect(split);
  split.connect(left, 0);
  split.connect(right, 1);
  const data = new Uint8Array(left.frequencyBinCount);
  const wave = new Uint8Array(left.fftSize);
  const rms = (node) => {
    node.getByteTimeDomainData(wave);
    let sum = 0;
    for (const v of wave) sum += ((v - 128) / 128) ** 2;
    return Math.min(1, Math.sqrt(sum / wave.length) * 2.6);
  };
  const timer = setInterval(() => {
    left.getByteFrequencyData(data);
    const bands = [];
    for (let i = 0; i < 16; i += 1) {
      const a = Math.floor(2 ** (i * 0.46));
      const b = Math.max(a + 1, Math.floor(2 ** ((i + 1) * 0.46)));
      let peak = 0;
      for (let j = a; j < b && j < data.length; j += 1) peak = Math.max(peak, data[j]);
      bands.push(Math.round((peak / 255) * 100) / 100);
    }
    engineSend('audio', { l: rms(left), r: rms(right), bass: Math.max(bands[0], bands[1], bands[2]) ** 2, bands });
  }, 33);
  capture = { stream, ctx, timer };
};

window.stopCapture = function stopCapture() {
  if (!capture) return;
  clearInterval(capture.timer);
  capture.stream.getTracks().forEach((t) => t.stop());
  capture.ctx.close();
  capture = null;
};
