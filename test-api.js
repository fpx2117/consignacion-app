async function testInit() {
    const res = await fetch('http://localhost:3000/api/setup/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            admin: { nombre: 'Admin', email: 'admin@test.com', password: '123' },
            businessName: 'Test'
        })
    });
    console.log('Status:', res.status);
    const json = await res.json();
    console.log('Response:', JSON.stringify(json, null, 2));
}
testInit();
