// src/services/klaviyoService.js
const axios = require('axios');

// --------------------------------------------------------------------------
// KLAVIYO CONFIGURATION
// --------------------------------------------------------------------------

// List IDs (Optional, good for segmentation)
const LIST_ID_EMPLOYEE = "Xc8Pcv";
const LIST_ID_EMPLOYER = "VGcWV5";

// ⚠️ YOUR PRIVATE API KEY
const KLAVIYO_PRIVATE_KEY = "pk_8aa4622a920b89b233790944bbb639c87d"; 

const KLAVIYO_API_URL = 'https://a.klaviyo.com/api';

const headers = {
  'Authorization': `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
  'accept': 'application/vnd.api+json',
  'content-type': 'application/vnd.api+json',
  'revision': '2024-02-15'
};

/**
 * ✅ NEW: TRIGGER INVITATION FLOW
 * Called when Employer clicks "Invite" on dashboard.
 */
async function sendInvite(employee, inviteLink) {
  if (!KLAVIYO_PRIVATE_KEY) return false;

  // This Event Name MUST match what you look for in Klaviyo
  const eventName = "Employee Invited"; 

  try {
    const eventPayload = {
      data: {
        type: 'event',
        attributes: {
          profile: {
            email: employee.email,
            first_name: employee.firstName,
            last_name: employee.lastName,
            properties: {
               // These update the user's profile in Klaviyo
               Role: 'employee',
               Status: 'Invited'
            }
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
            // ✅ These variables are available in your Email Template
            invite_link: inviteLink,
            pay_type: employee.payType,
            company_name: "NWF Payroll Services", 
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
 * TRIGGER WELCOME FLOW
 * Called when account is fully created/activated.
 */
async function sendWelcomeEvent(user, tempPassword) {
  if (!KLAVIYO_PRIVATE_KEY) return false;

  const isEmployer = user.role === 'employer';
  const targetListId = isEmployer ? LIST_ID_EMPLOYER : LIST_ID_EMPLOYEE;
  const loginUrl = isEmployer ? 'https://nwfpayroll.com/employer-login.html' : 'https://nwfpayroll.com/employee-login.html';
  const eventName = "NWF Account Created"; 

  try {
    // 1. Add to List (Suppress error if already exists)
    const profilePayload = {
      data: {
        type: 'profile-subscription-bulk-create-job',
        attributes: {
          list_id: targetListId,
          custom_source: 'NWF Admin Dashboard',
          profiles: {
            data: [{
              type: 'profile',
              attributes: {
                email: user.email,
                first_name: user.firstName,
                last_name: user.lastName,
                properties: { Role: user.role }
              }
            }]
          }
        }
      }
    };
    await axios.post(`${KLAVIYO_API_URL}/profile-subscription-bulk-create-jobs/`, profilePayload, { headers }).catch(() => {});

    // 2. Send Event
    const eventPayload = {
      data: {
        type: 'event',
        attributes: {
          profile: { email: user.email, first_name: user.firstName, last_name: user.lastName },
          metric: { data: { type: 'metric', attributes: { name: eventName } } },
          properties: {
            TemporaryPassword: tempPassword,
            LoginURL: loginUrl,
            Role: user.role
          },
          time: new Date().toISOString()
        }
      }
    };

    await axios.post(`${KLAVIYO_API_URL}/events/`, eventPayload, { headers });
    console.log(`✅ Klaviyo: Triggered '${eventName}' for ${user.email}`);
    return true;

  } catch (error) {
    console.error('❌ Klaviyo Welcome Error:', error.message);
    return false;
  }
}

module.exports = { sendWelcomeEvent, sendInvite };
