import dotenv from 'dotenv';
dotenv.config();

const firebaseProjectId = 'frostybite07';
const firebaseDatabaseId = 'ai-studio-5220f74d-5467-4ae2-a84f-6cf35908747c';
const key = 'AIzaSyBmfCBuc_UzCKfS1DN6OKnZPsri3MFkcdU';

async function run() {
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/service_pincodes?key=${key}`;
  console.log('Fetching Firestore service_pincodes from URL:', url);
  
  const res = await fetch(url);
  if (res.ok) {
    const json = await res.json();
    console.log('Result from Firestore:');
    if (json.documents) {
      json.documents.forEach((doc: any) => {
        console.log('Doc name:', doc.name);
        console.log('Doc fields:', JSON.stringify(doc.fields));
      });
    } else {
      console.log('No documents found in Firestore service_pincodes collection');
    }
  } else {
    console.error('Failed to fetch from Firestore REST:', res.status, await res.text());
  }
}

run();
