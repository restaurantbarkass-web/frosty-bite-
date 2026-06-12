async function run() {
  const getUrl = 'http://localhost:3000/api/service-pincodes';
  const patchUrl = 'http://localhost:3000/api/service-pincodes/test_pin_1';

  // Generate a valid-looking test token
  const testPayload = {
    iss: 'https://securetoken.google.com/frostybite07',
    email: 'restaurantbarkass@gmail.com',
    user_id: 'test-user-123'
  };
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64').replace(/=/g, '');
  const payloadStr = Buffer.from(JSON.stringify(testPayload)).toString('base64').replace(/=/g, '');
  const signature = 'securesig';
  const token = `${header}.${payloadStr}.${signature}`;

  console.log('1. Fetch initial pincodes:');
  let res = await fetch(getUrl);
  let pincodes = await res.json();
  console.log('test_pin_1 Active state:', pincodes.find((p: any) => p.id === 'test_pin_1')?.active);

  console.log('2. Sending PATCH active: true to test_pin_1...');
  res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ active: true })
  });
  console.log('PATCH response status:', res.status);
  console.log('PATCH response JSON:', await res.json());

  console.log('3. Fetch again after PATCH:');
  res = await fetch(getUrl);
  pincodes = await res.json();
  console.log('test_pin_1 Active state:', pincodes.find((p: any) => p.id === 'test_pin_1')?.active);

  console.log('4. Sending PATCH active: false to test_pin_1...');
  res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ active: false })
  });
  console.log('PATCH response status:', res.status);
  console.log('PATCH response JSON:', await res.json());

  console.log('5. Fetch again after PATCH to false:');
  res = await fetch(getUrl);
  pincodes = await res.json();
  console.log('test_pin_1 Active state:', pincodes.find((p: any) => p.id === 'test_pin_1')?.active);
}

run();
