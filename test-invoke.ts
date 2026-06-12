async function testPatch() {
  console.log('Sending PATCH to /api/delivery-areas/area_4...');
  try {
    const response = await fetch('http://localhost:3000/api/delivery-areas/area_4', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        // Mock a bearer token that has the correct email format to bypass local fallback isAdmin
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InJlc3RhdXJhbnRiYXJrYXNzQGdtYWlsLmNvbSJ9.signature'
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
