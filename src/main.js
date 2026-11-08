import './style.css';
import './mobile.css';
import './simple.css';
import { CityWorld } from './world.js';
import { startGame } from './app.js';
import { loadAuthoredCharacters } from './authored-characters.js';

const loading = document.createElement('section'); loading.className = 'avatar-loading'; loading.setAttribute('role', 'status');
const title = document.createElement('h1'); title.textContent = '街へ出かける準備中';
const message = document.createElement('p'); message.textContent = 'キャラクターを読み込んでいます…';
loading.append(title, message); document.body.append(loading);
function begin() { loading.remove(); startGame(CityWorld); }
loadAuthoredCharacters(undefined, event => {
  message.textContent = event.total ? `キャラクターを読み込んでいます… ${Math.round(event.loaded / event.total * 100)}%` : 'キャラクターを読み込んでいます…';
}).then(begin).catch(error => {
  console.error('Character loading failed', error);
  title.textContent = 'キャラクターを読み込めませんでした'; message.textContent = '通信を確認して、もう一度お試しください。';
  const retry = document.createElement('button'); retry.className = 'primary'; retry.textContent = 'もう一度読み込む';
  retry.addEventListener('click', () => location.reload());
  const fallback = document.createElement('button'); fallback.textContent = '軽量モデルで始める'; fallback.addEventListener('click', begin, { once: true });
  loading.append(retry, fallback);
});
