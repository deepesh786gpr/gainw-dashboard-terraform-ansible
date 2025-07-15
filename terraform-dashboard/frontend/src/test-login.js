// Simple script to test login API

async function testLogin() {
  try {
    console.log('Testing login API...');
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123',
        rememberMe: true
      }),
    });
    
    const data = await response.json();
    console.log('Login response status:', response.status);
    console.log('Login response:', data);
    return data;
  } catch (error) {
    console.error('Login API error:', error);
    return { error: error.message };
  }
}

testLogin();