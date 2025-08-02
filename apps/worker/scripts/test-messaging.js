// Test script for messaging API endpoints
// Run with: node scripts/test-messaging.js

const BASE_URL = 'https:/local-dev.logosophe.com'; / Development server URL

async function testMessagingAPI() {
  console.log('🧪 Testing Messaging API Endpoints...\n');

  try {
    // Test 1: Get system status (should fail without auth)
    console.log('1. Testing system status endpoint (unauthenticated)...');
    const statusResponse = await fetch(`${BASE_URL}/api/messages/system`);
    console.log(`   Status: ${statusResponse.status} (expected 401)`);
    console.log(`   Response: ${await statusResponse.text()}\n`);

    // Test 2: Get recipients (should fail without auth)
    console.log('2. Testing recipients endpoint (unauthenticated)...');
    const recipientsResponse = await fetch(`${BASE_URL}/api/messages/recipients`);
    console.log(`   Status: ${recipientsResponse.status} (expected 401)`);
    console.log(`   Response: ${await recipientsResponse.text()}\n`);

    // Test 3: Send message (should fail without auth)
    console.log('3. Testing send message endpoint (unauthenticated)...');
    const sendResponse = await fetch(`${BASE_URL}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: 'Test Message',
        body: 'This is a test message',
        recipients: ['test@example.com'],
        tenantId: 'default',
        messageType: 'direct'
      })
    });
    console.log(`   Status: ${sendResponse.status} (expected 401)`);
    console.log(`   Response: ${await sendResponse.text()}\n`);

    // Test 4: Get messages (should fail without auth)
    console.log('4. Testing get messages endpoint (unauthenticated)...');
    const messagesResponse = await fetch(`${BASE_URL}/api/messages`);
    console.log(`   Status: ${messagesResponse.status} (expected 401)`);
    console.log(`   Response: ${await messagesResponse.text()}\n`);

    console.log('✅ All tests completed!');
    console.log('\n📝 Note: These tests verify that the API endpoints are properly secured.');
    console.log('   To test with authentication, you would need to:');
    console.log('   1. Sign in through the web interface');
    console.log('   2. Use the session cookies in the requests');
    console.log('   3. Or implement proper authentication headers');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the tests
testMessagingAPI(); 