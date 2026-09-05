/**
 * CA Excel Generator Module
 * Uses SheetJS to compile a multi-sheet, CA-ready Reconciliation Pack (.xlsx)
 */

window.CAExcelGenerator = (function () {

    function generateCAWorkbook(consolidatedResult) {
        if (!window.XLSX) {
            alert('SheetJS (XLSX) library is still loading. Please try again in a moment.');
            return;
        }

        const wb = XLSX.utils.book_new();
        const { metrics, taxSummaryRows, allTrades, allPayouts, accountSummaries } = consolidatedResult;

        // ---------------------------------------------------------
        // Sheet 1: CA Cover Note & Tax Summary
        // ---------------------------------------------------------
        const coverData = [
            ['CA RECONCILIATION PACK - STATEMENT ENGINE SUMMARY'],
            ['Generated Date:', new Date().toLocaleString()],
            ['Platform:', 'CA Layer - Data Compilation & Reconciliation Tool'],
            ['Legal Notice:', 'This document is a data compilation prepared for CA review and return filing. Not direct tax advice.'],
            [''],
            ['TAX CATEGORIZATION SCHEDULE (INDIAN INCOME TAX SHAPE)'],
            ['Tax Category', 'ITR Income Head', 'Gross Volume / Value (INR)', 'Expenses / Charges (INR)', 'Net Taxable P&L (INR)', 'Filing Status']
        ];

        taxSummaryRows.forEach(row => {
            coverData.push([
                row.category,
                row.head,
                row.grossVolINR.toFixed(2),
                row.expensesINR.toFixed(2),
                row.netINR.toFixed(2),
                row.status
            ]);
        });

        coverData.push(['']);
        coverData.push(['CONSOLIDATED TOTALS']);
        coverData.push(['Total Prop Firm Payouts (INR):', metrics.propGrossINR.toFixed(2)]);
        coverData.push(['Total Speculative Trading Net P&L (INR):', metrics.specNetINR.toFixed(2)]);
        coverData.push(['Total F&O / Derivatives Net P&L (INR):', metrics.foNetINR.toFixed(2)]);
        coverData.push(['CONSOLIDATED NET TAXABLE BASE (INR):', metrics.totalNetINR.toFixed(2)]);

        const wsCover = XLSX.utils.aoa_to_sheet(coverData);
        XLSX.utils.book_append_sheet(wb, wsCover, 'CA Tax Summary');

        // ---------------------------------------------------------
        // Sheet 2: Consolidated Trade Ledger
        // ---------------------------------------------------------
        const tradeHeaders = ['Ticket / Deal ID', 'Account Number', 'Broker', 'Open Time', 'Close Time', 'Type', 'Symbol', 'Lots', 'Open Price', 'Close Price', 'Commission (USD)', 'Swap (USD)', 'Gross Profit (USD)', 'Net P&L (USD)', 'Net P&L (INR)', 'Tax Bucket'];
        const tradeData = [tradeHeaders];

        allTrades.forEach(t => {
            tradeData.push([
                t.ticket,
                t.accountNumber,
                t.broker,
                t.openTime,
                t.closeTime,
                t.type,
                t.symbol,
                t.size,
                t.openPrice,
                t.closePrice,
                t.commission,
                t.swap,
                t.grossProfit,
                t.netPnL,
                (t.netPnL * 83.50).toFixed(2),
                t.taxCategory
            ]);
        });

        const wsTrades = XLSX.utils.aoa_to_sheet(tradeData);
        XLSX.utils.book_append_sheet(wb, wsTrades, 'Trade Ledger');

        // ---------------------------------------------------------
        // Sheet 3: Prop Firm Payouts
        // ---------------------------------------------------------
        const payoutHeaders = ['Payout Date', 'Prop Firm Name', 'Account Reference', 'Payment Method', 'Original Payout (USD)', 'Exchange Rate (USD->INR)', 'INR Converted Value', 'Tax Classification', 'Verification'];
        const payoutData = [payoutHeaders];

        allPayouts.forEach(p => {
            payoutData.push([
                p.payoutDate,
                p.propFirm,
                p.accountRef,
                p.paymentMethod,
                p.originalAmount,
                p.inrRate,
                p.inrValue,
                p.taxHead,
                p.verificationStatus
            ]);
        });

        const wsPayouts = XLSX.utils.aoa_to_sheet(payoutData);
        XLSX.utils.book_append_sheet(wb, wsPayouts, 'Prop Firm Payouts');

        // ---------------------------------------------------------
        // Sheet 4: Account Reconciliation
        // ---------------------------------------------------------
        const accHeaders = ['Account Number', 'Broker / Source', 'Platform', 'Initial Deposit (USD)', 'Total Closed Net P&L (USD)', 'Total Withdrawals (USD)', 'Estimated Ending Balance (USD)', 'Status'];
        const accData = [accHeaders];

        accountSummaries.forEach(a => {
            accData.push([
                a.accountNumber,
                a.broker,
                a.platform,
                a.initDeposit,
                a.netTradePnL,
                a.totalWithdrawals,
                a.endingBalance,
                a.reconciled
            ]);
        });

        const wsAcc = XLSX.utils.aoa_to_sheet(accData);
        XLSX.utils.book_append_sheet(wb, wsAcc, 'Account Reconciliation');

        // Trigger file download
        const timestamp = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `CA_Reconciliation_Pack_${timestamp}.xlsx`);
    }

    return {
        generateCAWorkbook
    };
})();
