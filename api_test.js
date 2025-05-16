const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = 3001;

// Middleware for parsing JSON
app.use(bodyParser.json());

// Test API endpoint
app.post('/api/test', (req, res) => {
  console.log('Received request:', req.body);
  res.json({
    success: true,
    message: 'API is working',
    receivedText: req.body.text || 'No text provided'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on http://localhost:${PORT}`);
  console.log(`Try this command to test:`);
  console.log(`curl -X POST http://localhost:${PORT}/api/test -H "Content-Type: application/json" -d "{\\"text\\":\\"Test message\\"}"`);
}); 