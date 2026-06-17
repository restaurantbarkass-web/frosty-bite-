import dotenv from 'dotenv';
dotenv.config();

const firebaseProjectId = 'frostybite07';
const firebaseDatabaseId = 'ai-studio-5220f74d-5467-4ae2-a84f-6cf35908747c';
const key = 'AIzaSyBmfCBuc_UzCKfS1DN6OKnZPsri3MFkcdU';

async function run() {
  const urlDefault = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/service_pincodes?key=${key}`;
  const urlCustom = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/service_pincodes?key=${key}`;
  
  console.log('1. Trying (default) database REST:');
  let res = await fetch(urlDefault);
  if (res.ok) {
    console.log('✅ (default) REST Success');
  } else {
    console.error('❌ (default) REST Failure:', res.status, await res.text());
  }

  console.log('2. Trying custom database REST:');
  res = await fetch(urlCustom);
  if (res.ok) {
    console.log('✅ custom database REST Success');
  } else {
    console.error('❌ custom database REST Failure:', res.status, await res.text());
  }
}

run();
