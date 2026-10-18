import '@platform/ui-kit/tokens.css';
import '@platform/ui-kit/base.css';
import '@platform/ui-kit';
import './shell.css';
import { createRoot } from 'react-dom/client';
import { Host } from './App.js';
import { devSession } from './host/index.js';

createRoot(document.getElementById('root')!).render(<Host session={devSession()} />);
