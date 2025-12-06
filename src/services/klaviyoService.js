// src/services/klaviyoService.js
const axios = require('axios');

// --------------------------------------------------------------------------
// KLAVIYO CONFIGURATION
// --------------------------------------------------------------------------

// List IDs provided
const LIST_ID_EMPLOYEE = "Xc8Pcv";
const LIST_ID_EMPLOYER = "VGcWV5";

// ⚠️ IMPORTANT: This must be your PRIVATE API Key (starts with pk_...)
const KLAVIYO_PRIVATE_KEY = "pk_8aa4622a920b89b233790944bbb639c87d"; 

const KLAVIYO_API_URL = 'https://a.klaviyo.com/api';

const headers = {
  'Authorization': `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
  'accept': 'application/vnd.api+json',
  'content-type': 'application/vnd.api+json',
  'revision': '2024-02-15'
};

/**
 * ✅ NEW: Handles sending the Invitation Link to a new employee
 * Trigger this from: POST /api/employees/invite
 */
async function sendInvite(employee, inviteLink) {
  if (!KLAVIYO_PRIVATE_KEY) {
    console.warn("⚠️ Klaviyo Private Key is missing. Invite email skipped.");
    return false;
  }

  const eventName = "Employee Invited"; // <--- Trigger Name for your Klaviyo Flow

  try {
    const eventPayload = {
      data: {
        type: 'event',
        attributes: {
          profile: {
            email: employee.email,
            first_name: employee.firstName,
            last_name: employee.lastName
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
            // These variables are available in your Email Template as {{ event.invite_link }}
            invite_link: inviteLink,
            pay_type: employee.payType,
            role: 'employee',
            action: "Invitation Sent"
          },
          time: new Date().toISOString()
        }
      }
    };

    await axios.post(`${KLAVIYO_API_URL}/events/`, eventPayload, { headers });
    
    console.log(`✅ Klaviyo: Triggered '${eventName}' for ${employee.email}`);
    return true;

  } catch (error) {
    console.error('❌ Klaviyo Invite Error:', error.response ? JSON.stringify(error.response.data) : error.message);
    return false;
  }
}

/**
 * Handles adding user to the correct list and triggering the Welcome Flow.
 * Used when Admin manually creates a user.
 */
async function sendWelcomeEvent(user, tempPassword) {
  if (!KLAVIYO_PRIVATE_KEY) return false;

  // 1. Determine Logic based on Role
  const isEmployer = user.role === 'employer';
  const targetListId = isEmployer ? LIST_ID_EMPLOYER : LIST_ID_EMPLOYEE;
  
  const loginUrl = isEmployer 
    ? 'https://www.nwfpayroll.com/employer-login.html' 
    : 'https://www.nwfpayroll.com/employee-login.html';

  const eventName = "NWF Account Created"; 

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
                    Role: user.role,
                    Company: user.companyName || 'NWF Payroll'
                  }
                }
              }
            ]
          }
        }
      }
    };

    // Suppress 409 errors (Already subscribed)
    await axios.post(`${KLAVIYO_API_URL}/profile-subscription-bulk-create-jobs/`, profilePayload, { headers })
      .catch(err => console.log("Info: Profile list subscription:", err.response?.data?.errors?.[0]?.detail || "Already subscribed"));


    // --- STEP 2: Trigger the Event ---
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
    
    console.log(`✅ Klaviyo: Triggered '${eventName}' for ${user.email}`);
    return true;

  } catch (error) {
    console.error('❌ Klaviyo Welcome Error:', error.response ? JSON.stringify(error.response.data) : error.message);
    return false;
  }
}

// ✅ EXPORT BOTH FUNCTIONS
module.exports = { sendWelcomeEvent, sendInvite };
