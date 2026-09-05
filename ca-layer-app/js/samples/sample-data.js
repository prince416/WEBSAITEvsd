/**
 * Sample Data Provider Module
 * Provides realistic MT4 HTML statements, MT5 CSV statements, and Prop Firm Payout receipts for instant testing.
 */

window.SampleDataProvider = (function () {

    const SAMPLES = {
        'mt4-html': {
            name: 'MT4_Forex_Statement_884920.html',
            type: 'mt4',
            content: `
            <html>
            <head><title>Statement: 884920 - Akash Sharma</title></head>
            <body>
            <table>
            <tr><td colspan="14"><b>Account: 884920 (BlueberryMarkets-Live)</b></td></tr>
            <tr><td colspan="14"><b>Closed Transactions:</b></td></tr>
            <tr bgcolor="#E0E0E0">
                <td>Ticket</td><td>Open Time</td><td>Type</td><td>Size</td><td>Item</td><td>Price</td><td>S/L</td><td>T/P</td><td>Close Time</td><td>Price</td><td>Commission</td><td>Taxes</td><td>Swap</td><td>Profit</td>
            </tr>
            <tr><td>7194012</td><td>2026.08.01 10:14</td><td>buy</td><td>1.00</td><td>EURUSD</td><td>1.0850</td><td>1.0810</td><td>1.0920</td><td>2026.08.01 14:30</td><td>1.0895</td><td>-7.00</td><td>0.00</td><td>-1.20</td><td>450.00</td></tr>
            <tr><td>7194850</td><td>2026.08.02 09:20</td><td>sell</td><td>0.50</td><td>GBPUSD</td><td>1.2740</td><td>1.2780</td><td>1.2650</td><td>2026.08.02 11:15</td><td>1.2690</td><td>-3.50</td><td>0.00</td><td>0.00</td><td>250.00</td></tr>
            <tr><td>7195320</td><td>2026.08.03 15:45</td><td>buy</td><td>2.00</td><td>XAUUSD</td><td>2420.50</td><td>2410.00</td><td>2440.00</td><td>2026.08.03 18:22</td><td>2435.10</td><td>-14.00</td><td>0.00</td><td>-4.50</td><td>2920.00</td></tr>
            <tr><td>7196109</td><td>2026.08.04 16:00</td><td>buy</td><td>0.50</td><td>US30</td><td>39800.00</td><td>39600.00</td><td>40200.00</td><td>2026.08.04 19:10</td><td>39650.00</td><td>-5.00</td><td>0.00</td><td>0.00</td><td>-750.00</td></tr>
            <tr><td>7190000</td><td>2026.08.01 08:00</td><td>deposit</td><td>0.00</td><td>Deposit</td><td>0.00</td><td>0.00</td><td>0.00</td><td>2026.08.01 08:00</td><td>0.00</td><td>0.00</td><td>0.00</td><td>0.00</td><td>10000.00</td></tr>
            </table>
            </body>
            </html>
            `
        },
        'mt5-csv': {
            name: 'MT5_Prop_Account_104928.csv',
            type: 'mt5',
            content: `
            Account: 104928 (Finotive-Live)
            Deal,Date,Type,Symbol,Size,Price,Commission,Swap,Profit
            1001,2026-08-05 09:00:00,balance,Deposit,0,0,0,0,50000.00
            1002,2026-08-05 12:30:00,buy,BTCUSD,0.10,64200.00,-2.50,-1.10,380.00
            1003,2026-08-06 14:15:00,sell,DE40,1.00,18250.00,-4.00,0.00,-220.00
            1004,2026-08-07 10:05:00,buy,EURJPY,1.50,161.20,-6.00,-2.40,640.00
            `
        },
        'prop-payout': {
            name: 'InstantFunding_Payout_Receipt_PF9938.txt',
            type: 'prop',
            content: `
            INSTANT FUNDING - PAYOUT RECONCILIATION STATEMENT
            Date: 2026-08-15
            Account: PF-99381-LIVE
            Prop Firm: Instant Funding
            Trader: Akash Sharma
            Payment Method: Deel Bank Transfer / Crypto
            Payout Amount: $3,450.00
            Status: Completed & Verified
            `
        }
    };

    return {
        SAMPLES
    };
})();
