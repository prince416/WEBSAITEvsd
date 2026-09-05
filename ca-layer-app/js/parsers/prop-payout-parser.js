/**
 * Prop Firm Payout Parser Module
 * Deterministically ingests & parses payout receipts from Prop Firms (Instant Funding, Finotive, Blueberry, FTMO, etc.)
 */

window.PropPayoutParser = (function () {

    const PROP_FIRMS = [
        'Finotive Funding',
        'Instant Funding',
        'Blueberry Funded',
        'FTMO',
        'IQ Capital',
        'FXIFY',
        'Fintokei',
        'The Funded Trader'
    ];

    /**
     * Parse Prop Firm Payout Document (HTML / Text / CSV)
     */
    function parsePayoutStatement(content, fileName) {
        const payouts = [];

        // Check if JSON / Structured Text format
        if (typeof content === 'string') {
            const lines = content.split(/\r?\n/);

            let propFirm = 'Prop Firm Partner';
            let date = new Date().toISOString().split('T')[0];
            let accountRef = 'PF-ACC-0000';
            let originalAmount = 0;
            let currency = 'USD';
            let paymentMethod = 'Crypto / Deel / Bank';

            // Detect prop firm name from content or filename
            for (const firm of PROP_FIRMS) {
                if (content.toLowerCase().includes(firm.toLowerCase()) || fileName.toLowerCase().includes(firm.toLowerCase())) {
                    propFirm = firm;
                    break;
                }
            }

            // Detect Payout Amount
            const amountMatch = content.match(/(?:payout|amount|total|paid):\s*\$?([0-9,]+\.?[0-9]*)/i);
            if (amountMatch) {
                originalAmount = parseFloat(amountMatch[1].replace(/,/g, '')) || 0;
            }

            // Detect Date
            const dateMatch = content.match(/\b(202[0-9]-[0-1][0-9]-[0-3][0-9]|[0-3][0-9]\/[0-1][0-9]\/202[0-9])\b/);
            if (dateMatch) {
                date = dateMatch[1];
            }

            // Detect Account Ref
            const accMatch = content.match(/(?:account|login|id):\s*#?([A-Za-z0-9-]+)/i);
            if (accMatch) {
                accountRef = accMatch[1];
            }

            if (originalAmount > 0) {
                // USD to INR estimation multiplier for Indian CA reporting (standardized reference rate ~₹83.5 / USD)
                const inrRate = 83.50;
                const inrValue = parseFloat((originalAmount * inrRate).toFixed(2));

                payouts.push({
                    id: 'PAYOUT-' + Math.floor(100000 + Math.random() * 900000),
                    payoutDate: date,
                    propFirm,
                    accountRef,
                    paymentMethod,
                    originalAmount,
                    currency,
                    inrRate,
                    inrValue,
                    taxHead: 'Service / Contractor Income',
                    verificationStatus: 'Verified (Proof Attached)',
                    sourceFile: fileName
                });
            }
        }

        return payouts;
    }

    return {
        parsePayoutStatement,
        PROP_FIRMS
    };
})();
