import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign browser SCTP teardown messages ("Close called") emitted during peer disconnect
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const text = args
      .map((a) => {
        if (a instanceof Error) return `${a.name}: ${a.message} ${a.stack || ''}`;
        if (typeof a === 'object' && a !== null) {
          try {
            return JSON.stringify(a) + ' ' + ((a as any).message || '') + ' ' + ((a as any).reason || '');
          } catch {
            return String(a);
          }
        }
        return String(a);
      })
      .join(' ');

    if (
      text.includes('Close called') ||
      text.includes('User-Initiated Abort') ||
      text.includes('peer left room') ||
      text.includes('peer disconnected')
    ) {
      // Benign WebRTC data-channel close event during normal departure
      return;
    }
    originalError.apply(console, args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const text = event.reason?.message || String(event.reason || '');
    if (
      text.includes('Close called') ||
      text.includes('User-Initiated Abort') ||
      text.includes('peer left room') ||
      text.includes('peer disconnected')
    ) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
