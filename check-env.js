import dotenv from 'dotenv';
dotenv.config();

for (const [key, value] of Object.entries(process.env)) {
  if (!value) {
    console.log(`${key}: empty`);
  } else {
    const masked = value.length > 15 ? `${value.substring(0, 6)}... (${value.length} chars)` : value;
    console.log(`${key}: ${masked}`);
  }
}

