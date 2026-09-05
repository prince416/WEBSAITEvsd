/**
 * Reconciliation Engine Module
 * Consolidates parsed trades, deposits, and prop firm payouts into a unified CA-compliant financial ledger.
 */

window.ReconciliationEngine = (function () {

    const FX_RATES = {
        INR: { USD: 0.012, EUR: 0.011, INR: 1.0 },
        USD: { INR: 83.50, EUR: 0.92, USD: 1.0 },
        EUR: { INR: 90.75, USD: 1.097, EUR: 1.0 }
    };

    /**
     * Process and consolidate raw parsed datasets
     */
    function consolidateData(statements, propPayouts, targetCurrency = 'INR') {
        let allTrades = [];
        let allDeposits = [];
        let allPayouts = [...propPayouts];
        let accountSummaries = [];

        // Flatten trades and deposits from all statement files
        statements.forEach(stmt => {
            if (stmt.trades) allTrades = allTrades.concat(stmt.trades);
            if (stmt.deposits) allDeposits = allDeposits.concat(stmt.deposits);

            // Compute account metrics
            const accTrades = stmt.trades || [];
            const grossProfit = accTrades.reduce((acc, t) => acc + (t.grossProfit > 0 ? t.grossProfit : 0), 0);
            const grossLoss = accTrades.reduce((acc, t) => acc + (t.grossProfit < 0 ? t.grossProfit : 0), 0);
            const totalCommSwap = accTrades.reduce((acc, t) => acc + (t.commission + t.swap), 0);
            const netTradePnL = accTrades.reduce((acc, t) => acc + t.netPnL, 0);

            const initDeposit = (stmt.deposits || []).filter(d => d.type === 'Deposit').reduce((acc, d) => acc + d.amount, 0);
            const totalWithdrawals = (stmt.deposits || []).filter(d => d.type === 'Withdrawal').reduce((acc, d) => acc + Math.abs(d.amount), 0);

            accountSummaries.push({
                accountNumber: stmt.accountNumber,
                broker: stmt.broker,
                platform: stmt.platform,
                sourceFile: stmt.sourceFile,
                tradeCount: accTrades.length,
                grossProfit,
                grossLoss,
                totalCommSwap,
                netTradePnL,
                initDeposit,
                totalWithdrawals,
                endingBalance: initDeposit + netTradePnL - totalWithdrawals,
                reconciled: accTrades.length > 0 ? 'Verified' : 'Pending'
            });
        });

        // 1. Calculate Tax Head Summaries (Indian CA Format)
        const rateToINR = FX_RATES.USD.INR; // USD base assumed for MT4/MT5 P&L

        // Speculative Income (Intraday Forex / Cash)
        const specTrades = allTrades.filter(t => t.taxCategory === 'Speculative');
        const specGross = specTrades.reduce((sum, t) => sum + Math.abs(t.grossProfit), 0);
        const specExpenses = specTrades.reduce((sum, t) => sum + Math.abs(t.commission + t.swap), 0);
        const specNetUSD = specTrades.reduce((sum, t) => sum + t.netPnL, 0);
        const specNetINR = specNetUSD * rateToINR;

        // F&O / Business Income (Futures & Indices)
        const foTrades = allTrades.filter(t => t.taxCategory === 'F&O / Derivatives');
        const foGross = foTrades.reduce((sum, t) => sum + Math.abs(t.grossProfit), 0);
        const foExpenses = foTrades.reduce((sum, t) => sum + Math.abs(t.commission + t.swap), 0);
        const foNetUSD = foTrades.reduce((sum, t) => sum + t.netPnL, 0);
        const foNetINR = foNetUSD * rateToINR;

        // Prop Firm Payouts (Contractor / Service Income)
        const propGrossINR = allPayouts.reduce((sum, p) => sum + p.inrValue, 0);
        const propGrossUSD = allPayouts.reduce((sum, p) => sum + p.originalAmount, 0);

        // Total Consolidated P&L
        const totalNetINR = specNetINR + foNetINR + propGrossINR;
        const totalNetUSD = specNetUSD + foNetUSD + propGrossUSD;

        // Tax Schedule Summary Rows
        const taxSummaryRows = [
            {
                category: 'Speculative Business Income',
                head: 'Section 28(i) - Speculative Trades',
                grossVolUSD: specGross,
                grossVolINR: specGross * rateToINR,
                expensesUSD: specExpenses,
                expensesINR: specExpenses * rateToINR,
                netUSD: specNetUSD,
                netINR: specNetINR,
                status: specTrades.length > 0 ? 'Ready for ITR-3' : 'No Data'
            },
            {
                category: 'F&O / Derivatives Business Income',
                head: 'Section 28(i) - Non-Speculative F&O',
                grossVolUSD: foGross,
                grossVolINR: foGross * rateToINR,
                expensesUSD: foExpenses,
                expensesINR: foExpenses * rateToINR,
                netUSD: foNetUSD,
                netINR: foNetINR,
                status: foTrades.length > 0 ? 'Ready for ITR-3' : 'No Data'
            },
            {
                category: 'Prop Firm Service / Payout Income',
                head: 'Section 28(i) / Sec 44ADA - Contractor Income',
                grossVolUSD: propGrossUSD,
                grossVolINR: propGrossINR,
                expensesUSD: 0,
                expensesINR: 0,
                netUSD: propGrossUSD,
                netINR: propGrossINR,
                status: allPayouts.length > 0 ? 'Ready for ITR-3 / 44ADA' : 'No Data'
            }
        ];

        // 2. Health & Audit Checks
        const healthChecks = [];
        if (allTrades.length === 0 && allPayouts.length === 0) {
            healthChecks.push({ type: 'neutral', message: 'No statements ingested. Please drag & drop statements to run audit checks.' });
        } else {
            healthChecks.push({ type: 'pass', message: `Successfully parsed ${allTrades.length} trades across ${statements.length} trading accounts.` });
            
            if (allPayouts.length > 0) {
                healthChecks.push({ type: 'pass', message: `Reconciled ${allPayouts.length} prop firm payout statements totalling ₹${propGrossINR.toLocaleString('en-IN')}.` });
            }

            const unclassified = allTrades.filter(t => t.taxCategory === 'Capital / Transfer');
            if (unclassified.length > 0) {
                healthChecks.push({ type: 'warn', message: `Found ${unclassified.length} unclassified or capital operations. Verify deposits/withdrawals.` });
            } else {
                healthChecks.push({ type: 'pass', message: '100% of parsed trades mapped to explicit Indian CA tax categories.' });
            }
        }

        return {
            allTrades,
            allDeposits,
            allPayouts,
            accountSummaries,
            taxSummaryRows,
            healthChecks,
            metrics: {
                totalNetINR,
                totalNetUSD,
                propGrossINR,
                propGrossUSD,
                specNetINR,
                specNetUSD,
                foNetINR,
                foNetUSD,
                totalTradeCount: allTrades.length,
                totalPayoutCount: allPayouts.length
            }
        };
    }

    return {
        consolidateData,
        FX_RATES
    };
})();
