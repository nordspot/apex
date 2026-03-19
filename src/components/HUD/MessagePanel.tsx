import { useUIStore } from '../../stores/useUIStore';

export function MessagePanel() {
  const message = useUIStore((s) => s.message);

  if (!message) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(5, 20, 51, 0.82)',
        border: '1px solid rgba(77, 194, 255, 0.70)',
        borderRadius: 16,
        backdropFilter: 'blur(12px)',
        padding: '20px 32px',
        color: 'rgba(255, 255, 255, 0.95)',
        fontSize: 18,
        fontWeight: 500,
        textAlign: 'center',
        maxWidth: 340,
        lineHeight: 1.5,
        boxShadow: '0 0 25px rgba(0, 150, 255, 0.25), inset 0 1px 0 rgba(204, 242, 255, 0.16)',
        animation: 'fadeInUp 0.3s ease-out',
        whiteSpace: 'pre-line',
      }}
    >
      {message}
    </div>
  );
}
