// Simple script to test API connectivity

async function testApiConnection() {
  try {
    console.log('Testing API connection...');
    const response = await fetch('http://localhost:5000/api/health');
    const data = await response.json();
    console.log('API response:', data);
    return data;
  } catch (error) {
    console.error('API connection error:', error);
    return { error: error.message };
  }
}

testApiConnection();