// src/services/klaviyoService.js
const axios = require('axios');

// --------------------------------------------------------------------------
// KLAVIYO CONFIGURATION
// --------------------------------------------------------------------------

// List IDs provided
const LIST_ID_EMPLOYEE = "WDXx6g";
const LIST_ID_EMPLOYER = "UDESG8";

// ⚠️ IMPORTANT: This must be your PRIVATE API Key (starts with pk_...), NOT the Public Site ID (TqthwF).
const KLAVIYO_PRIVATE_KEY = "pk_db5e64516e47905c28c220e5e3aac4388a"; 

const KLAVIYO_API_URL = 'https://a.klaviyo.com/api';

/**
 * Handles adding user to the correct list and triggering the Welcome Flow.
 * @param {Object} user - The user object (must contain email, firstName, lastName, role)
 * @param {String} tempPassword - The raw temporary password to send in email
 */
async function sendWelcomeEvent(user, tempPassword) {
  // Security check
  if (!KLAVIYO_PRIVATE_KEY) {
    console.warn("⚠️ Klaviyo Private Key is missing in .env. Email event skipped.");
    return false;
  }

  const headers = {
    'Authorization': `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
    'accept': 'application/vnd.api+json',
    'content-type': 'application/vnd.api+json',
    'revision': '2024-02-15' // Using modern API revision
  };

  // 1. Determine Logic based on Role
  const isEmployer = user.role === 'employer';
  
  const targetListId = isEmployer ? LIST_ID_EMPLOYER : LIST_ID_EMPLOYEE;
  
  const loginUrl = isEmployer 
    ? 'https://www.nwfpayroll.com/employer-login.html' 
    : 'https://www.nwfpayroll.com/employee-login.html';

  const eventName = "NWF Account Created"; // This is the Trigger Name for your Flow

  try {
    // --- STEP 1: Add Profile to Specific List ---
    const profilePayload = {
      data: {
        type: 'profile-subscription-bulk-create-job',
        attributes: {
          list_id: targetListId,
          custom_source: 'NWF Admin Dashboard',
          profiles: {
            data: [
              {
                type: 'profile',
                attributes: {
                  email: user.email,
                  first_name: user.firstName,
                  last_name: user.lastName,
                  properties: {
                    Role: user.role, // 'employee' or 'employer'
                    Company: user.companyName || 'NWF Payroll'
                  }
                }
              }
            ]
          }
        }
      }
    };

    // We suppress errors here because if they are already on the list, Klaviyo throws a 409, which is fine.
    await axios.post(`${KLAVIYO_API_URL}/profile-subscription-bulk-create-jobs/`, profilePayload, { headers })
      .catch(err => console.log("Info: Profile list subscription:", err.response?.data?.errors?.[0]?.detail || "Already subscribed"));


    // --- STEP 2: Trigger the Event (Starts the Email Flow) ---
    // You will use "NWF Account Created" as the trigger in Klaviyo
    const eventPayload = {
      data: {
        type: 'event',
        attributes: {
          profile: {
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName
          },
          metric: {
            data: {
              type: 'metric',
              attributes: {
                name: eventName
              }
            }
          },
          properties: {
            // These variables are available in your Email Template as {{ event.TemporaryPassword }}
            TemporaryPassword: tempPassword,
            LoginURL: loginUrl,
            Role: user.role,
            Action: "Account Created"
          },
          time: new Date().toISOString()
        }
      }
    };

    await axios.post(`${KLAVIYO_API_URL}/events/`, eventPayload, { headers });
    
    console.log(`✅ Klaviyo: Added ${user.email} to list ${targetListId} and triggered '${eventName}'`);
    return true;

  } catch (error) {
    console.error('❌ Klaviyo Error:', error.response ? JSON.stringify(error.response.data) : error.message);
    return false;
  }
}

module.exports = { sendWelcomeEvent };
