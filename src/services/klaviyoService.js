const axios = require('axios');

// --------------------------------------------------------------------------
// KLAVIYO CONFIGURATION
// --------------------------------------------------------------------------
const KLAVIYO_LIST_ID = "SqBSRf"; 

// ⚠️ Configured with the key you provided. 
// If emails fail, verify this is the full 'Private API Key' from Klaviyo Settings.
const KLAVIYO_PRIVATE_KEY = process.env.KLAVIYO_PRIVATE_KEY || "pk_XVSQvc"; 

const KLAVIYO_API_URL = 'https://a.klaviyo.com/api';

/**
 * 1. Subscribe the user to the "Employees" list.
 * 2. Trigger the "Employee Onboarding" event to send the welcome email.
 */
async function sendOnboardingEmail(email, firstName, tempPassword, loginUrl) {
  // Security check to prevent crashes if key is missing
  if (!KLAVIYO_PRIVATE_KEY || !KLAVIYO_PRIVATE_KEY.startsWith("pk_")) {
    console.warn("⚠️ Klaviyo Private Key is missing or invalid. It must start with 'pk_'. Email event skipped.");
    return false;
  }

  const headers = {
    'Authorization': `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
    'accept': 'application/vnd.api+json',
    'content-type': 'application/vnd.api+json',
    'revision': '2023-10-15'
  };

  try {
    // --- STEP 1: Create/Update Profile & Subscribe to List ---
    const profilePayload = {
      data: {
        type: 'profile-subscription-bulk-create-job',
        attributes: {
          list_id: KLAVIYO_LIST_ID,
          custom_source: 'NWF Payroll Admin',
          profiles: {
            data: [
              {
                type: 'profile',
                attributes: {
                  email: email,
                  first_name: firstName,
                  properties: {
                    Role: 'Employee',
                    System: 'NWF Payroll'
                  }
                }
              }
            ]
          }
        }
      }
    };

    // Suppress error if already subscribed (common scenario)
    await axios.post(`${KLAVIYO_API_URL}/profile-subscription-bulk-create-jobs/`, profilePayload, { headers })
      .catch(err => console.log("Note: Profile subscription info:", err.response?.data?.errors?.[0]?.detail || err.message));


    // --- STEP 2: Trigger the Event (Starts the Email Flow) ---
    const eventPayload = {
      data: {
        type: 'event',
        attributes: {
          profile: {
            email: email,
            first_name: firstName
          },
          metric: {
            name: 'Employee Onboarding Triggered' // Matches the metric in your Flow
          },
          properties: {
            // These variables are passed to your Email Template
            TemporaryPassword: tempPassword,
            LoginURL: loginUrl,
            Action: "Account Created"
          },
          time: new Date().toISOString()
        }
      }
    };

    await axios.post(`${KLAVIYO_API_URL}/events/`, eventPayload, { headers });
    
    console.log(`✅ Klaviyo: Subscribed ${email} to list ${KLAVIYO_LIST_ID} and triggered onboarding event.`);
    return true;

  } catch (error) {
    console.error('❌ Klaviyo Error:', error.response ? JSON.stringify(error.response.data) : error.message);
    return false;
  }
}

module.exports = { sendOnboardingEmail };
