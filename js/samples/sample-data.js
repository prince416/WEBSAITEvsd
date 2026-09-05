/**
 * Reconcilr Built-in Synthetic Sample Data Provider
 * Provides realistic accepted-source examples across broker CSVs, prop payouts,
 * payout platforms, and crypto exchanges.
 */

window.SampleDataProvider = (function () {

    const SAMPLES = {
        'broker-csv': {
            name: 'Blueberry_Live_Account_884920.csv',
            type: 'broker',
            content: `
            Deal,Date,Type,Symbol,Size,Price,Commission,Swap,Profit
            7194012,2026-08-01 14:30:00,buy,EURUSD,2.00,1.0895,-14.00,-2.40,1420.00
            7194850,2026-08-02 11:15:00,sell,GBPUSD,1.00,1.2690,-7.00,0.00,500.00
            7195320,2026-08-03 18:22:00,buy,XAUUSD,3.00,2435.10,-21.00,-6.50,4380.00
            7196109,2026-08-04 19:10:00,buy,US30,1.00,39650.00,-10.00,0.00,-1500.00
            `
        },
        'prop-payout': {
            name: 'Finotive_Payout_Receipt_PF9041.txt',
            type: 'prop',
            content: `
            FINOTIVE FUNDING - PAYOUT RECONCILIATION RECEIPT
            Date: 2026-08-12
            Account: PF-9041-LIVE
            Prop Firm: Finotive Funding
            Trader: Alex Mercer
            Payment Method: Rise Pay / Deel
            Payout Amount: $5,200.00
            Profit Split: 80/20
            Status: Verified
            `
        },
        'deel-payout': {
            name: 'Deel_Rise_Payout_Statement_AUG2026.csv',
            type: 'payment',
            content: `
            Date,Description,Amount,Currency
            2026-08-13,Finotive Prop Payout #PF-9041,5200.00,USD
            2026-08-13,Wire Transfer Fee Deductions,-35.00,USD
            `
        },
        'crypto-csv': {
            name: 'Binance_Futures_Export_2026.csv',
            type: 'crypto',
            content: `
            Date,Symbol,Side,Realized_PnL
            2026-08-14,BTCUSDT,BUY,1240.50
            2026-08-14,ETHUSDT,SELL,-320.00
            `
        }
    };

    return {
        SAMPLES
    };
})();
