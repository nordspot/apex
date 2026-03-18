import { useState, useEffect } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { formatTime } from '../../utils/highscores';

export function Timer() {
  const startTime = useUIStore((s) => s.startTime);
  const endTime = useUIStore((s) => s.endTime);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!startTime || endTime) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [startTime, endTime]);

  if (!startTime) return null;

  const elapsed = (endTime ?? now) - startTime;

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        left: 20,
        background: 'rgba(5, 20, 51, 0.72)',
        border: '1px solid rgba(77, 194, 255, 0.70)',
        borderRadius: 12,
        backdropFilter: 'blur(10px)',
        padding: '10px 18px',
        color: 'rgba(255, 255, 255, 0.95)',
        fontSize: 16,
        fontWeight: 600,
        letterSpacing: 1.5,
        fontVariantNumeric: 'tabular-nums',
        boxShadow: '0 0 15px rgba(0, 150, 255, 0.15), inset 0 1px 0 rgba(204, 242, 255, 0.16)',
      }}
    >
      {formatTime(elapsed)}
    </div>
  );
}
