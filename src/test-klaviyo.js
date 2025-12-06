// test-klaviyo.js
const axios = require('axios');

// ⚠️ PASTE YOUR REAL "pk_..." KEY HERE
const PRIVATE_KEY = 'pk_8aa4622a920b89b233790944bbb639c87d'; 

async function runTest() {
  console.log("🚀 Attempting to send event to Klaviyo...");

  const options = {
    method: 'POST',
    url: 'https://a.klaviyo.com/api/events/',
    headers: {
      'Authorization': `Klaviyo-API-Key ${PRIVATE_KEY}`,
      'accept': 'application/vnd.api+json',
      'content-type': 'application/vnd.api+json',
      'revision': '2024-02-15'
    },
    data: {
      data: {
        type: 'event',
        attributes: {
          profile: {
            email: 'test_admin_trigger@example.com',
            first_name: 'Test',
            last_name: 'User'
          },
          metric: {
            data: {
              type: 'metric',
              attributes: {
                name: 'NWF Account Created'
              }
            }
          },
          properties: {
            TemporaryPassword: 'TestPass123!',
            LoginURL: 'https://www.nwfpayroll.com/employer-login.html',
            Role: 'employer',
            Action: 'Test Script'
          }
        }
      }
    }
  };

  try {
    const res = await axios(options);
    console.log("✅ SUCCESS! Status Code:", res.status);
    console.log("🎉 Go check your Klaviyo Metrics list now!");
  } catch (error) {
    console.error("❌ FAILED!");
    if (error.response) {
      console.error("Status:", error.response.status); // 401 = Bad Key, 400 = Bad Data
      console.error("Reason:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Error:", error.message);
    }
  }
}

runTest();
