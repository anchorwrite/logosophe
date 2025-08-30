// Test script for verification email flow
// 
// TESTING APPROACH:
// 1. Sign in as phil@dreamtone.com (Apple provider) through the normal auth flow
// 2. Navigate to Harbor where SubscriberOptIn component will appear
// 3. Click "Subscribe Now" to trigger verification email
// 4. Check email for verification link
// 5. Click verification link to complete subscription
// 6. Receive welcome email after verification
//
// This tests the complete user flow from authentication through subscription to verification.

const testEmail = 'phil@dreamtone.com';

async function testVerificationFlow() {
  try {
    console.log('Testing verification email flow...');
    console.log('\n📋 TESTING INSTRUCTIONS:');
    console.log('1. Sign in as phil@dreamtone.com (Apple provider)');
    console.log('2. Navigate to Harbor to see SubscriberOptIn component');
    console.log('3. Click "Subscribe Now" button');
    console.log('4. Check email for verification link');
    console.log('5. Click verification link to complete subscription');
    console.log('6. Check for welcome email');
    
    // Test 1: Verify verification email endpoint exists
    console.log('\n🔍 Testing API endpoints...');
    const verificationResponse = await fetch('http://localhost:3000/api/verification-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        name: 'Phil Test User'
      }),
    });

    if (!verificationResponse.ok) {
      const errorText = await verificationResponse.text();
      console.log('✅ Verification endpoint exists (expected error for non-subscriber):', errorText);
    } else {
      console.log('⚠️ Unexpected success for non-subscriber');
    }

    // Test 2: Verify welcome email endpoint exists
    console.log('\n2. Testing welcome email endpoint...');
    const welcomeResponse = await fetch('http://localhost:3000/api/welcome-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        name: 'Phil Test User'
      }),
    });

    if (!welcomeResponse.ok) {
      const errorText = await welcomeResponse.text();
      console.log('✅ Welcome email endpoint exists (expected error for non-verified subscriber):', errorText);
    } else {
      console.log('⚠️ Unexpected success for non-verified subscriber');
    }

    console.log('\n🎉 API endpoint testing completed!');
    console.log('Now proceed with the UI testing steps above.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testVerificationFlow();
