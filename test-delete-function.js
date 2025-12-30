// Test script to check delete-account Edge Function
// Run with: node test-delete-function.js

const SUPABASE_URL = 'https://kkpkpybqbtmcvriqrmrt.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here'; // Replace with your anon key
const USER_JWT = 'your-jwt-token-here'; // Replace with a valid JWT from a logged-in user

async function testDeleteAccount() {
  try {
    console.log('Testing delete-account Edge Function...');
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${USER_JWT}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        reason: 'Testing deletion',
        userAgent: 'Test Script',
      }),
    });

    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.error('Error:', data);
    } else {
      console.log('Success!');
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

testDeleteAccount();
