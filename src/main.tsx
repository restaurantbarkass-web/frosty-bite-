import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

console.log('App mounting started...');

// Catch unhandled rejections globally
window.onunhandledrejection = (event) => {
  console.error('Unhandled Rejection:', event.reason);
};

try {
  const root = document.getElementById('root');
  if (!root) throw new Error('Root element not found');
  
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  console.log('App mounted successfully');
} catch (error) {
  console.error('Mounting failed:', error);
}
