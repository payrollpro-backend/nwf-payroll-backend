// test-klaviyo.js
const axios = require('axios');

// ⚠️ REPLACE THIS WITH YOUR REAL PRIVATE KEY (starts with pk_)
const API_KEY = "pk_8aa4622a920b89b233790944bbb639c87d"; 

async function runTest() {
    console.log("🚀 Starting Klaviyo Connection Test...");

    if (!API_KEY || !API_KEY.startsWith('pk_')) {
        console.error("❌ ERROR: Invalid API Key. It must start with 'pk_'.");
        return;
    }

    try {
        const payload = {
            data: {
                type: 'event',
                attributes: {
                    profile: {
                        email: "test.employee@example.com",
                        first_name: "Test",
                        last_name: "User"
                    },
                    metric: {
                        data: {
                            type: 'metric',
                            attributes: {
                                name: "Employee Invited" // This is the metric we are forcing
                            }
                        }
                    },
                    properties: {
                        action: "Test Run",
                        invite_link: "https://nwfpayroll.com/test-link"
                    }
                }
            }
        };

        console.log("📨 Sending payload to Klaviyo...");

        const res = await axios.post(
            'https://a.klaviyo.com/api/events/',
            payload,
            {
                headers: {
                    'Authorization': `Klaviyo-API-Key ${API_KEY}`,
                    'accept': 'application/vnd.api+json',
                    'content-type': 'application/vnd.api+json',
                    'revision': '2024-02-15'
                }
            }
        );

        console.log("✅ SUCCESS! Klaviyo responded with Status:", res.status);
        console.log("👉 Go to Klaviyo > Flows > Create Flow > Choose 'Employee Invited' metric.");

    } catch (error) {
        console.error("❌ FAILED!");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Reason:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("Error:", error.message);
        }
    }
}

runTest();
