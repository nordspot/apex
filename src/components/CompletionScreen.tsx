import { useState } from 'react';
import { BRAND } from '../constants/brand';
import { useUIStore } from '../stores/useUIStore';
import { usePlayerStore } from '../stores/usePlayerStore';
import { saveHighScore, getHighScores, formatTime, type HighScore } from '../utils/highscores';

export function CompletionScreen() {
  const elapsed = useUIStore.getState().getElapsedMs();
  const [name, setName] = useState('');
  const [scores, setScores] = useState<HighScore[]>(() => getHighScores());
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const updated = saveHighScore(name || 'Spieler', elapsed);
    setScores(updated);
    setSaved(true);
  }

  function handleReplay() {
    usePlayerStore.getState().reset();
    useUIStore.getState().setGamePhase('start');
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 10, 30, 0.9)',
        fontFamily: BRAND.font,
        color: BRAND.textLight,
        padding: 24,
      }}
    >
      <h1
        style={{
          fontSize: 32,
          fontWeight: 800,
          marginBottom: 8,
          background: `linear-gradient(135deg, #fff, ${BRAND.primaryLight})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        MEMO-9 Repariert!
      </h1>

      <div
        style={{
          fontSize: 48,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: '#4DC2FF',
          margin: '12px 0 24px',
          textShadow: '0 0 20px rgba(0,150,255,0.5)',
        }}
      >
        {formatTime(elapsed)}
      </div>

      {/* Save score */}
      {!saved ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <input
            type="text"
            placeholder="Dein Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: `1px solid ${BRAND.panelBorder}`,
              borderRadius: 8,
              padding: '10px 14px',
              color: '#fff',
              fontSize: 16,
              fontFamily: BRAND.font,
              outline: 'none',
              width: 160,
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <button
            onClick={handleSave}
            style={{
              background: BRAND.primary,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: BRAND.font,
            }}
          >
            Speichern
          </button>
        </div>
      ) : (
        <div style={{ color: '#4DC2FF', marginBottom: 24, fontSize: 14 }}>Gespeichert!</div>
      )}

      {/* Leaderboard */}
      {scores.length > 0 && (
        <div
          style={{
            background: BRAND.panelBg,
            border: `1px solid ${BRAND.panelBorder}`,
            borderRadius: 16,
            padding: '16px 24px',
            maxWidth: 320,
            width: '100%',
            marginBottom: 24,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, letterSpacing: 2, marginBottom: 12, textAlign: 'center' }}>
            BESTENLISTE
          </h3>
          {scores.map((s, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: i < scores.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                fontSize: 15,
              }}
            >
              <span>
                <span style={{ color: BRAND.textMuted, marginRight: 8 }}>{i + 1}.</span>
                {s.name}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: '#4DC2FF' }}>{formatTime(s.timeMs)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Replay */}
      <button
        onClick={handleReplay}
        style={{
          background: 'rgba(255,255,255,0.1)',
          color: '#fff',
          border: `1px solid ${BRAND.panelBorder}`,
          borderRadius: 12,
          padding: '14px 40px',
          fontSize: 18,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: BRAND.font,
        }}
      >
        Nochmal spielen
      </button>
    </div>
  );
}
