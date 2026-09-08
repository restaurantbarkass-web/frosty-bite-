async function run() {
  const url = 'http://localhost:3000/api/service-pincodes';
  console.log('Sending GET to', url);
  try {
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      console.log('Response from API:');
      console.log(json);
    } else {
      console.error('API Error:', res.status, await res.text());
    }
  } catch (err: any) {
    console.error('Fetch exception:', err.message);
  }
}
run();
