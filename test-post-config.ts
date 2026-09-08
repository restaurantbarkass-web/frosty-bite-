import fetch from 'node-fetch';

function generateFakeJwt(email: string) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64').replace(/=/g, '');
  const payload = Buffer.from(JSON.stringify({
    iss: "securetoken.google.com/frostybite07",
    email: email,
    email_verified: true,
    sub: "fake_firebase_uid_123"
  })).toString('base64').replace(/=/g, '');
  return `${header}.${payload}.fakesignature`;
}

async function test() {
  const token = generateFakeJwt('restaurantbarkass@gmail.com');
  const payload = {
    isOrderingOpen: true,
    deliveryBaseFee: 15,
    deliveryFeePerKm: 5,
    deliveryFreeKm: 3
  };

  console.log('Sending POS to http://localhost:3000/api/config ...');
  try {
    const res = await fetch('http://localhost:3000/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    console.log('Response Status:', res.status);
    const bodyText = await res.text();
    console.log('Response Body:', bodyText);
  } catch (err: any) {
    console.error('Request failed:', err.message || err);
  }
}

test();
