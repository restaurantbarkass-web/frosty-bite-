async function testPatch() {
  console.log('Sending PATCH to /api/delivery-areas/area_4...');
  try {
    const response = await fetch('http://localhost:3000/api/delivery-areas/area_4', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_TEST_TOKEN || 'test-token'}`
      },
      body: JSON.stringify({
        is_deliverable: true
      })
    });
    
    console.log('Response Status:', response.status);
    const bodyText = await response.text();
    console.log('Response Body:', bodyText);
  } catch (err: any) {
    console.error('Fetch error:', err.message);
  }
}

testPatch();
