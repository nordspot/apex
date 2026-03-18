import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// StrictMode disabled: it double-mounts effects which destroys WebGL contexts in Firefox
createRoot(document.getElementById('root')!).render(<App />);
