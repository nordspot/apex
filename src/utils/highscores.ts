export interface HighScore {
  name: string;
  timeMs: number;
  date: string;
}

const KEY = 'apex-highscores';

export function getHighScores(): HighScore[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const scores: HighScore[] = JSON.parse(raw);
    return scores.sort((a, b) => a.timeMs - b.timeMs).slice(0, 10);
  } catch {
    return [];
  }
}

export function saveHighScore(name: string, timeMs: number): HighScore[] {
  const scores = getHighScores();
  scores.push({ name: name || 'Spieler', timeMs, date: new Date().toISOString().slice(0, 10) });
  scores.sort((a, b) => a.timeMs - b.timeMs);
  const top10 = scores.slice(0, 10);
  localStorage.setItem(KEY, JSON.stringify(top10));
  return top10;
}

export function formatTime(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  const tenths = Math.floor((totalSec * 10) % 10);
  return `${min}:${sec.toString().padStart(2, '0')}.${tenths}`;
}
