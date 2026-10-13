import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const vi = {
  appName: 'Tò He',
  tagline: 'Góc chơi nhỏ của cả nhà',
  games: 'Trò chơi',
  play: 'Chơi',
  exit: 'Thoát',
  mute: 'Tắt tiếng',
  unmute: 'Bật tiếng',
  loading: 'Đang tải…',
  offline: 'Đang ngoại tuyến — hiển thị danh sách đã lưu',
  noGames: 'Chưa có trò chơi nào. Hãy build game rồi chờ API đồng bộ danh mục.',
  loadFailed: 'Không tải được danh sách trò chơi.',
  gameNotFound: 'Không tìm thấy trò chơi này.',
  gameFailed: 'Trò chơi không phản hồi. Thử lại sau nhé.',
  untrusted: 'Trò chơi không nằm trên nguồn được phép, đã chặn.',
  best: 'Kỷ lục: {{score}}',
  back: 'Về danh sách',
};

const en: typeof vi = {
  appName: 'Tò He',
  tagline: 'A little play corner for the whole family',
  games: 'Games',
  play: 'Play',
  exit: 'Exit',
  mute: 'Mute',
  unmute: 'Unmute',
  loading: 'Loading…',
  offline: 'Offline — showing the saved list',
  noGames: 'No games yet. Build a game and wait for the API to sync the catalog.',
  loadFailed: 'Could not load the games.',
  gameNotFound: 'Game not found.',
  gameFailed: 'The game is not responding. Please try again later.',
  untrusted: 'This game is not on an allowed origin and was blocked.',
  best: 'Best: {{score}}',
  back: 'Back to games',
};

void i18n.use(initReactI18next).init({
  resources: { vi: { translation: vi }, en: { translation: en } },
  lng: navigator.language.toLowerCase().startsWith('en') ? 'en' : 'vi',
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
});

export default i18n;
