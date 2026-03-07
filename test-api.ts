import http from 'http';

async function testApi() {
    http.get('http://localhost:3000/api/productos', (res) => {
        console.log('Status Code:', res.statusCode);
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log('Response body length:', data.length);
            if (res.statusCode !== 200) {
                console.log('Error body:', data.substring(0, 500));
            } else {
                console.log('Success (first 100 chars):', data.substring(0, 100));
            }
        });
    }).on('error', (err) => {
        console.error('Error:', err.message);
    });
}

testApi();
