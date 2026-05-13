import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Root } from './Root';
import './assets/app.css';
import './assets/tokens.css';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<Root />
	</StrictMode>
);
