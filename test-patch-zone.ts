async function run() {
  const getUrl = 'http://localhost:3000/api/service-zones';
  const testPayload = {
    iss: 'https://securetoken.google.com/frostybite07',
    email: 'restaurantbarkass@gmail.com',
    user_id: 'test-user-123'
  };
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64').replace(/=/g, '');
  const payloadStr = Buffer.from(JSON.stringify(testPayload)).toString('base64').replace(/=/g, '');
  const signature = 'securesig';
  const token = `${header}.${payloadStr}.${signature}`;

  console.log('1. Fetch initial zones:');
  let res = await fetch(getUrl);
  let zones = await res.json();
  console.log('Service zones:', zones);

  if (zones.length > 0) {
    const targetZone = zones[0];
    const patchUrl = `http://localhost:3000/api/service-zones/${targetZone.id}`;
    console.log(`2. Sending PATCH to ${targetZone.id} (${targetZone.city_name}) with status: ${!targetZone.is_active}...`);
    res = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ is_active: !targetZone.is_active })
    });
    console.log('PATCH response status:', res.status);
    console.log('PATCH response JSON:', await res.json());
  }
}

run();
