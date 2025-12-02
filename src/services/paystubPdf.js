<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Paystub Visual Preview</title>
  <style>
    /* RESET & BASE */
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 12px;
      color: #000;
      margin: 0;
      padding: 0;
      background: #e0e0e0; 
      display: flex;
      justify-content: center;
      padding-top: 40px;
    }
    
    .page-sheet {
      background: #fff;
      width: 850px; 
      min-height: 1100px; 
      margin: 0 auto;
      position: relative; 
      box-shadow: 0 4px 15px rgba(0,0,0,0.2); 
      overflow: hidden;
    }

    /* BACKGROUND LAYER */
    .page-bg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1; 
      object-fit: cover;
    }

    /* CONTENT LAYER */
    .page-content {
      position: relative;
      z-index: 2; /* Must be higher than page-bg */
      padding: 60px 70px 50px 70px; 
    }

    /* UTILITIES */
    .clear { clear: both; }
    .bold { font-weight: bold; }
    .right { text-align: right; }
    .left { text-align: left; }
    
    /* LAYOUT SECTIONS */
    .header-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }

    /* HEADER */
    .company-info {
      font-weight: bold;
      font-size: 14px;
      line-height: 1.4;
    }
    
    .payroll-service-branding {
      text-align: right;
      font-weight: bold;
      color: #333;
    }
    
    .payroll-title {
      font-size: 14px;
      border-bottom: 2px solid #000;
      display: inline-block;
      margin-bottom: 5px;
    }

    /* EMPLOYEE & DATES SECTION */
    .employee-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      border-top: 1px solid #ccc;
      border-bottom: 1px solid #ccc;
      padding: 15px 0;
    }
    
    .emp-details {
      line-height: 1.5;
    }
    
    .emp-name {
      font-weight: bold;
      font-size: 14px;
    }
    
    .pay-dates-table {
      border-collapse: collapse;
    }
    
    .pay-dates-table td {
      padding: 2px 10px;
      font-weight: bold;
      font-size: 11px;
    }

    /* FINANCIAL TABLES */
    .financial-section {
      margin-bottom: 20px;
    }
    
    .section-title {
      font-weight: bold; 
      margin-bottom: 5px;
    }
    
    table.financials {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    
    table.financials th {
      text-align: right;
      border-bottom: 1px solid #000;
      padding: 5px;
      font-weight: bold;
      font-size: 11px;
    }
    
    table.financials th:first-child {
      text-align: left;
    }
    
    table.financials td {
      text-align: right;
      padding: 5px;
      /* CHANGED: Border color to black #000 based on your request */
      border-bottom: 1px solid #000;
    }
    
    table.financials td:first-child {
      text-align: left;
    }

    /* NET PAY BOX */
    .net-pay-box {
      margin-top: 20px;
      text-align: right;
      font-size: 16px;
      font-weight: bold;
      padding: 10px;
      background: #eee;
      border: 1px solid #ccc;
      display: inline-block;
      float: right;
      min-width: 200px;
    }
    
    .ytd-net-text {
      font-size: 12px; 
      font-weight: normal; 
      margin-top: 5px; 
      color: #666;
    }

    /* FOOTER */
    .footer {
      clear: both;
      margin-top: 50px;
      text-align: center;
      font-size: 10px;
      color: #666;
      border-top: 1px dotted #ccc;
      padding-top: 10px;
    }
  </style>
</head>
<body>

<div class="page-sheet">
  
  <!-- BACKGROUND IMAGE -->
  <img src="https://www.nwfpayroll.com/nwf-bg.png" class="page-bg" alt="background">

  <div class="page-content">
    
    <!-- HEADER -->
    <div class="header-row">
      <div class="company-info">
        <div>NSE MANAGEMENT INC</div>
        <div style="font-weight: normal; margin-top: 10px;">
          4711 Nutmeg Way SW<br>
          Lilburn GA 30047
        </div>
      </div>
      <div class="payroll-service-branding">
        <div class="payroll-title">NWF PAYROLL SERVICES</div>
        <div style="font-size: 10px;">PAYROLL FOR SMALL BUSINESSES & SELF-EMPLOYED</div>
      </div>
    </div>

    <!-- EMPLOYEE INFO & DATES -->
    <div class="employee-section">
      <div class="emp-details">
        <div style="font-size: 10px; color: #666; margin-bottom: 5px;">EMPLOYEE</div>
        <div class="emp-name">GORDON, DAVID</div>
        <div style="margin-top: 5px;">Employee ID: xxxxxxx029383</div>
        <div style="margin-top: 10px;">
          507 SAN DRA WAY<br>
          MONROE, GA 30656
        </div>
      </div>
      
      <div>
        <table class="pay-dates-table">
          <tr>
            <td>Check Date:</td>
            <td>11/20/2025</td>
          </tr>
          <tr>
            <td>Pay Period Beginning:</td>
            <td>11/03/2025</td>
          </tr>
          <tr>
            <td>Pay Period Ending:</td>
            <td>11/16/2025</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- EARNINGS TABLE -->
    <div class="financial-section">
      <div class="section-title">Earnings</div>
      <table class="financials">
        <thead>
          <tr>
            <th width="40%">Description</th>
            <th width="15%">Hours</th>
            <th width="15%">Rate</th>
            <th width="15%">Current</th>
            <th width="15%">YTD</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Regular</td>
            <td>80.00</td>
            <td></td>
            <td>5,212.10</td>
            <td>208,484.00</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- DEDUCTIONS TABLE -->
    <div class="financial-section">
      <div class="section-title">Deductions From Gross</div>
      <table class="financials">
        <thead>
          <tr>
            <th width="55%">Description</th>
            <th width="15%"></th>
            <th width="15%">Current</th>
            <th width="15%">YTD</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Gross Pay</strong></td>
            <td></td>
            <td><strong>5,212.10</strong></td>
            <td><strong>208,484.00</strong></td>
          </tr>
          
          <tr>
            <td>Federal Income Tax</td>
            <td></td>
            <td>(927.92)</td>
            <td>(35,116.80)</td>
          </tr>
          <tr>
            <td>Social Security (Employee)</td>
            <td></td>
            <td>0.00</td>
            <td>(11,310.25)</td>
          </tr>
          <tr>
            <td>Medicare (Employee)</td>
            <td></td>
            <td>(122.48)</td>
            <td>(3,099.54)</td>
          </tr>
          <tr>
            <td>State of GA Income Tax</td>
            <td></td>
            <td>(282.89)</td>
            <td>(11,315.60)</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- NET PAY -->
    <div class="net-pay-box">
      NET PAY: $ 3,878.81
      <div class="ytd-net-text">
        YTD Net: $ 145,641.81
      </div>
    </div>
    <div class="clear"></div>

    <!-- FOOTER -->
    <div class="footer">
      Verify online at: https://nwf-payroll-backend.onrender.com/api/verify-paystub/39ED8B <br>
      Verification Code: <strong>39ED8B</strong>
    </div>
  </div>
</div>
</body>
</html>
