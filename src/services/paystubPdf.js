<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Paystub - <%= employeeFullName %></title>
  <style>
    * {
      box-sizing: border-box;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    body {
      margin: 0;
      padding: 0;
      font-size: 11px;
      color: #222;
    }

    .page {
      position: relative;
      width: 100%;
      min-height: 1056px; /* ~11 in at 96dpi */
      overflow: hidden;
    }

    .page-bg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: 0;
    }

    .page-content {
      position: relative;
      z-index: 1;
      /* slightly tighter top padding so it sits better in the boxes */
      padding: 40px 70px 40px 70px;
    }

    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .company-block-main {
      font-size: 11px;
      line-height: 1.4;
    }

    .company-name-main {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    .nwf-block {
      text-align: right;
      font-size: 10px;
      line-height: 1.4;
    }

    .nwf-title {
      font-weight: 700;
    }

    .nwf-subtitle {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .top-dates {
      margin-top: 6px;
      font-size: 10px;
    }

    .top-dates div {
      margin-bottom: 2px;
    }

    .top-stub {
      margin-bottom: 26px;
    }

    .stub-main-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }

    .stub-company-label {
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .employee-id-block {
      font-size: 10px;
      line-height: 1.4;
    }

    .employee-id-block .emp-name {
      font-weight: 600;
      margin-bottom: 2px;
    }

    .employee-id-block .emp-id {
      font-size: 10px;
    }

    .employee-address-block {
      font-size: 10px;
      text-align: right;
      line-height: 1.4;
    }

    .employee-address-name {
      font-weight: 600;
      font-size: 11px;
      margin-bottom: 2px;
    }

    .tables-row {
      display: flex;
      gap: 20px;
      margin-bottom: 14px;
    }

    .col-half {
      flex: 1;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }

    th, td {
      padding: 3px 4px;
      border-bottom: 1px solid #e5e7eb;
      text-align: right;
      white-space: nowrap;
    }

    th:first-child,
    td:first-child {
      text-align: left;
    }

    th {
      font-size: 9px;
      text-transform: uppercase;
      color: #555;
    }

    tfoot td {
      font-weight: 700;
      border-top: 1px solid #d1d5db;
    }

    .netpay-row {
      margin-top: 6px;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      justify-content: flex-end;
      gap: 30px;
      align-items: baseline;
    }

    .netpay-row .label {
      font-weight: 700;
    }

    .netpay-row .amount {
      font-weight: 700;
    }

    .netpay-row .ytd {
      font-weight: 700;
    }

    .bottom-stub {
      /* bring bottom stub up a bit so it sits in the second set of boxes */
      margin-top: 36px;
    }

    .bottom-stub .tables-row {
      margin-bottom: 12px;
    }

    .bottom-stub .netpay-row {
      margin-top: 6px;
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- BLANK BACKGROUND WITH BAND + LINES -->
    <img src="<%= backgroundUrl %>" class="page-bg" />

    <div class="page-content">
      <!-- TOP HEADER -->
      <div class="top-header">
        <div class="company-block-main">
          <div class="company-name-main">NSE MANAGEMENT INC</div>
          <div>4711 Nutmeg Way SW</div>
          <div>Lilburn GA 30047</div>
        </div>
        <div class="nwf-block">
          <div class="nwf-title">NWF PAYROLL SERVICES</div>
          <div class="nwf-subtitle">PAYROLL FOR SMALL BUSINESSES &amp; SELF- EMPLOYED</div>
          <div class="top-dates">
            <div>Check Date: <%= payDateFormatted %></div>
            <div>Pay Period Beginning: <%= payPeriodBeginFormatted || '' %></div>
            <div>Pay Period Ending: <%= payPeriodEndFormatted || '' %></div>
          </div>
        </div>
      </div>

      <!-- TOP STUB -->
      <div class="top-stub">
        <div class="stub-main-row">
          <div>
            <div class="stub-company-label">NSE MANAGEMENT INC</div>
            <div class="employee-id-block">
              <div class="emp-name"><%= employeeFullName %></div>
              <div class="emp-id">
                <% if (maskedEmployeeId) { %>
                  Employee ID: <%= maskedEmployeeId %>
                <% } else { %>
                  Employee ID:
                <% } %>
              </div>
            </div>
          </div>
          <div class="employee-address-block">
            <div class="employee-address-name"><%= employeeFullName %></div>
            <% if (employeeAddressLine1) { %>
              <div><%= employeeAddressLine1 %></div>
            <% } %>
            <% if (employeeAddressLine2) { %>
              <div><%= employeeAddressLine2 %></div>
            <% } %>
            <% if (employeeCity || employeeState || employeeZip) { %>
              <div>
                <%= employeeCity %><% if (employeeCity && (employeeState || employeeZip)) { %>, <% } %>
                <%= employeeState %>
                <%= employeeZip %>
              </div>
            <% } %>
          </div>
        </div>

        <div class="tables-row">
          <!-- Earnings -->
          <div class="col-half">
            <table>
              <thead>
                <tr>
                  <th>Earnings</th>
                  <th>Hours</th>
                  <th>Rate</th>
                  <th>Current</th>
                  <th>YTD</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Regular</td>
                  <td><%= regularHoursFormatted %></td>
                  <td><%= regularRateFormatted %></td>
                  <td>$<%= (grossPay || 0).toFixed(2) %></td>
                  <td>$<%= (ytdGross || 0).toFixed(2) %></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Deductions -->
          <div class="col-half">
            <table>
              <thead>
                <tr>
                  <th>Deductions From Gross:</th>
                  <th>Current</th>
                  <th>YTD</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Gross</td>
                  <td>$<%= (grossPay || 0).toFixed(2) %></td>
                  <td>$<%= (ytdGross || 0).toFixed(2) %></td>
                </tr>
                <tr>
                  <td>Federal Income Tax</td>
                  <td>($<%= (federalIncomeTax || 0).toFixed(2) %>)</td>
                  <td>($<%= (ytdFederalIncomeTax || 0).toFixed(2) %>)</td>
                </tr>
                <tr>
                  <td>Social Security (Employee)</td>
                  <td>($<%= (socialSecurity || 0).toFixed(2) %>)</td>
                  <td>($<%= (ytdSocialSecurity || 0).toFixed(2) %>)</td>
                </tr>
                <tr>
                  <td>Medicare (Employee)</td>
                  <td>($<%= (medicare || 0).toFixed(2) %>)</td>
                  <td>($<%= (ytdMedicare || 0).toFixed(2) %>)</td>
                </tr>
                <tr>
                  <td>State of GA Income Tax</td>
                  <td>($<%= (stateIncomeTax || 0).toFixed(2) %>)</td>
                  <td>($<%= (ytdStateIncomeTax || 0).toFixed(2) %>)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="netpay-row">
          <div class="label">Net Pay:</div>
          <div class="amount">$ <%= (netPay || 0).toFixed(2) %></div>
          <div class="ytd"><%= (ytdNet || 0).toFixed(2) %></div>
        </div>
      </div>

      <!-- BOTTOM STUB -->
      <div class="bottom-stub">
        <div class="tables-row">
          <!-- Earnings copy -->
          <div class="col-half">
            <table>
              <thead>
                <tr>
                  <th>Earnings</th>
                  <th>Hours</th>
                  <th>Rate</th>
                  <th>Current</th>
                  <th>YTD</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Regular</td>
                  <td><%= regularHoursFormatted %></td>
                  <td><%= regularRateFormatted %></td>
                  <td>$<%= (grossPay || 0).toFixed(2) %></td>
                  <td>$<%= (ytdGross || 0).toFixed(2) %></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Deductions copy -->
          <div class="col-half">
            <table>
              <thead>
                <tr>
                  <th>Deductions From Gross:</th>
                  <th>Current</th>
                  <th>YTD</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Gross</td>
                  <td>$<%= (grossPay || 0).toFixed(2) %></td>
                  <td>$<%= (ytdGross || 0).toFixed(2) %></td>
                </tr>
                <tr>
                  <td>Federal Income Tax</td>
                  <td>($<%= (federalIncomeTax || 0).toFixed(2) %>)</td>
                  <td>($<%= (ytdFederalIncomeTax || 0).toFixed(2) %>)</td>
                </tr>
                <tr>
                  <td>Social Security (Employee)</td>
                  <td>($<%= (socialSecurity || 0).toFixed(2) %>)</td>
                  <td>($<%= (ytdSocialSecurity || 0).toFixed(2) %>)</td>
                </tr>
                <tr>
                  <td>Medicare (Employee)</td>
                  <td>($<%= (medicare || 0).toFixed(2) %>)</td>
                  <td>($<%= (ytdMedicare || 0).toFixed(2) %>)</td>
                </tr>
                <tr>
                  <td>State of GA Income Tax</td>
                  <td>($<%= (stateIncomeTax || 0).toFixed(2) %>)</td>
                  <td>($<%= (ytdStateIncomeTax || 0).toFixed(2) %>)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="netpay-row">
          <div class="label">Net Pay:</div>
          <div class="amount">$ <%= (netPay || 0).toFixed(2) %></div>
          <div class="ytd"><%= (ytdNet || 0).toFixed(2) %></div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
