import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
import { supabase } from './supabase';

// Hard test for Supabase SDK
const test = async () => {
  const { data, error } = await supabase.from('products').select('*');

  if (error) {
    console.error("REAL ERROR:", error);
  } else {
    console.log("WORKING DATA:", data);
  }
};

test();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
