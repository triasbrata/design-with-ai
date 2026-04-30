import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <div data-caid="main">
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </div>
);
