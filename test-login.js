import axios from 'axios';

async function testLogin() {
  try {
    console.log('Testing login with admin/admin credentials...');
    const response = await axios.post('http://localhost:5000/api/login', {
      username: 'admin',
      password: 'admin'
    });
    
    console.log('Login successful!');
    console.log('User data:', response.data);
  } catch (error) {
    console.error('Login failed:', error.response ? error.response.data : error.message);
  }
}

testLogin();