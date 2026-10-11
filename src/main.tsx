import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { startCandleStore } from './store/candleStore';
import { startOrderMatching } from './store/tradeStore';
import './styles.css';

// Background consumers of the tick stream, independent of what's on screen.
startCandleStore();
startOrderMatching();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
