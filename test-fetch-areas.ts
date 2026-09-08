async function testFetch() {
  const url = 'http://localhost:3000/api/delivery-areas';
  try {
    const res = await fetch(url);
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Data count:', data?.length);
    console.log('Data:', JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error('Fetch error:', err.message);
  }
}

testFetch();
