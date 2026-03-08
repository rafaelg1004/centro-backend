const http = require('http');

http.get('http://localhost:5000/api/pacientes', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Data sample:', data.substring(0, 100));
        try {
            const json = JSON.parse(data);
            console.log('Length:', json.length);
        } catch (e) {
            console.log('JSON Parse Error');
        }
    });
});
