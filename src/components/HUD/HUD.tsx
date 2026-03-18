import { RepairCounter } from './RepairCounter';
import { MessagePanel } from './MessagePanel';

export function HUD() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      <RepairCounter />
      <MessagePanel />
      {/* Controls hint (desktop) */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(180, 210, 235, 0.6)',
          fontSize: 13,
          textAlign: 'center',
        }}
      >
        WASD to move · E to interact
      </div>
    </div>
  );
}
