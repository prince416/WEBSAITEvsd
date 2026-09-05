/**
 * Reconcilr Unified Statement Parsers & Confidence Scoring Engine
 * Deterministic ingestion for broker CSV exports, prop-firm payouts,
 * Rise/Deel/Wise/Payoneer receipts, and crypto exchange CSV exports.
 *
 * MT4/MT5 raw statement files are intentionally rejected. They can be edited
 * after export and are hard to distinguish from demo-account statements.
 */

window.UnifiedParsers = (function () {

    /**
     * Compute confidence score for parsed line items
     */
    function calculateConfidence(item, formatType) {
        let score = 100;
        
        if (!item.date || isNaN(new Date(item.date).getTime())) score -= 25;
        if (isNaN(item.amount) || item.amount === 0) score -= 30;
        if (!item.source || item.source.includes('Unknown')) score -= 20;

        if (formatType === 'mt4_html' && (!item.ticket && !item.id)) score -= 15;
        if (formatType === 'payment' && !item.reference) score -= 10;

        return Math.max(10, score);
    }

    function isMetaTraderRawStatement(content = '', fileName = '') {
        const text = `${fileName}\n${content}`.toLowerCase();
        return /(\bmt[45]\b|\bmt[45][_-]|metatrader|closed transactions:|open trades:|working orders:)/i.test(text);
    }

    /**
     * Reject MT4/MT5 raw statements by design.
     */
    function parseMT4HTML(htmlString, fileName = 'MT4_Statement.html') {
        const results = { trades: [], deposits: [], errors: [] };
        if (!htmlString || typeof htmlString !== 'string' || htmlString.trim().length === 0) {
            results.errors.push('File is empty or invalid string.');
            return results;
        }
        results.errors.push('MT4/MT5 raw statement files are not accepted. Use broker live-account CSV exports, prop-firm payout records, payout-platform receipts, crypto CSVs, or manual ledger entry instead.');
        return results;
    }

    /**
     * Ingest broker live-account / cTrader CSV statement
     */
    function parseCSVStatement(csvString, fileName = 'Trading_Statement.csv') {
        const results = { trades: [], deposits: [], errors: [] };
        if (!csvString || typeof csvString !== 'string' || csvString.trim().length === 0) {
            results.errors.push('File is empty or invalid string.');
            return results;
        }
        if (isMetaTraderRawStatement(csvString, fileName)) {
            results.errors.push('MT4/MT5 raw statement files are not accepted. Use broker live-account CSV exports or manual ledger entry instead.');
            return results;
        }

        try {
            const lines = csvString.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            let accountNumber = 'Trading-Account';

            lines.forEach((line, idx) => {
                if (line.toLowerCase().includes('account:')) {
                    const match = line.match(/account:\s*(\d+)/i);
                    if (match) accountNumber = match[1];
                    return;
                }

                const parts = line.split(/[,;\t]/).map(p => p.replace(/^"|"$/g, '').trim());
                if (parts.length >= 6 && !isNaN(parseFloat(parts[parts.length - 1]))) {
                    const ticket = parts[0] || `DEAL-${idx}`;
                    const date = parts[1] || new Date().toISOString().split('T')[0];
                    const type = (parts[2] || '').toLowerCase();
                    const symbol = parts[3] || 'FX';
                    const size = parseFloat(parts[4]) || 0;
                    const price = parseFloat(parts[5]) || 0;
                    const comm = parseFloat(parts[6]) || 0;
                    const swap = parseFloat(parts[7]) || 0;
                    const profit = parseFloat(parts[parts.length - 1]) || 0;

                    if (type.includes('balance') || type.includes('deposit') || type.includes('withdrawal')) {
                        results.deposits.push({
                            id: ticket,
                            date,
                            source: `Broker (${accountNumber})`,
                            instrumentType: 'transfer',
                            amount: profit,
                            description: type.toUpperCase(),
                            confidence: 100
                        });
                        return;
                    }

                    if ((type.includes('buy') || type.includes('sell')) && !isNaN(profit)) {
                        const tradeItem = {
                            id: ticket,
                            date,
                            source: `Broker (${accountNumber})`,
                            instrumentType: symbol.includes('BTC') || symbol.includes('ETH') ? 'crypto' : (symbol.includes('US30') || symbol.includes('NQ') ? 'futures' : 'forex'),
                            symbol,
                            type: type.toUpperCase(),
                            size,
                            openPrice: price,
                            closePrice: price,
                            commission: comm,
                            swap,
                            grossProfit: profit,
                            amount: parseFloat((profit + comm + swap).toFixed(2)),
                            confidence: 100
                        };
                        tradeItem.confidence = calculateConfidence(tradeItem, 'csv');
                        results.trades.push(tradeItem);
                    }
                }
            });

        } catch (err) {
            results.errors.push(`CSV Parser Exception: ${err.message}`);
        }

        return results;
    }

    /**
     * Ingest Prop Firm Payout Invoices & Receipts
     */
    function parsePropPayout(content, fileName = 'Prop_Payout.txt') {
        const results = { payouts: [], errors: [] };
        if (!content || typeof content !== 'string') {
            results.errors.push('Invalid payout content.');
            return results;
        }

        try {
            let propFirm = 'Prop Firm Partner';
            const FIRMS = ['Finotive Funding', 'Instant Funding', 'Blueberry Funded', 'FTMO', 'FundedNext', 'FXIFY', 'Fintokei', 'The Funded Trader'];
            FIRMS.forEach(f => {
                if (content.toLowerCase().includes(f.toLowerCase()) || fileName.toLowerCase().includes(f.toLowerCase())) {
                    propFirm = f;
                }
            });

            let date = new Date().toISOString().split('T')[0];
            const dateMatch = content.match(/\b(202[0-9]-[0-1][0-9]-[0-3][0-9]|[0-3][0-9]\/[0-1][0-9]\/202[0-9])\b/);
            if (dateMatch) date = dateMatch[1];

            let amount = 0;
            const amountMatch = content.match(/(?:payout|amount|total|paid):\s*\$?([0-9,]+\.?[0-9]*)/i);
            if (amountMatch) amount = parseFloat(amountMatch[1].replace(/,/g, '')) || 0;

            let accRef = 'PF-ACC-001';
            const accMatch = content.match(/(?:account|login|id):\s*#?([A-Za-z0-9-]+)/i);
            if (accMatch) accRef = accMatch[1];

            if (amount > 0) {
                const payoutItem = {
                    id: 'PAYOUT-' + Math.floor(100000 + Math.random() * 900000),
                    date,
                    source: `${propFirm} (${accRef})`,
                    instrumentType: 'prop-payout',
                    amount,
                    currency: 'USD',
                    description: `${propFirm} Payout Receipt #${accRef}`,
                    confidence: 95
                };
                results.payouts.push(payoutItem);
            } else {
                results.errors.push('No valid payout amount detected in file.');
            }

        } catch (err) {
            results.errors.push(`Prop Payout Exception: ${err.message}`);
        }

        return results;
    }

    /**
     * Ingest Payment Platforms (Rise, Deel, Wise, Payoneer, PayPal)
     */
    function parsePaymentPlatform(content, fileName = 'Payment_Export.csv') {
        const results = { payments: [], errors: [] };
        if (!content || typeof content !== 'string') {
            results.errors.push('Invalid payment platform export.');
            return results;
        }

        try {
            let platform = 'Rise Pay / Deel';
            if (content.toLowerCase().includes('deel') || fileName.toLowerCase().includes('deel')) platform = 'Deel';
            if (content.toLowerCase().includes('wise') || fileName.toLowerCase().includes('wise')) platform = 'Wise';
            if (content.toLowerCase().includes('payoneer') || fileName.toLowerCase().includes('payoneer')) platform = 'Payoneer';
            if (content.toLowerCase().includes('paypal') || fileName.toLowerCase().includes('paypal')) platform = 'PayPal';

            const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            lines.forEach((line, idx) => {
                const parts = line.split(/[,;\t]/).map(p => p.replace(/^"|"$/g, '').trim());
                if (parts.length >= 3) {
                    const date = parts[0];
                    const desc = parts[1] || 'Payout Transfer';
                    const amount = parseFloat(parts[2]) || parseFloat(parts[3]) || 0;

                    if (!isNaN(amount) && amount !== 0 && date.match(/202[0-9]/)) {
                        results.payments.push({
                            id: `PAY-${platform.toUpperCase()}-${idx}`,
                            date,
                            source: platform,
                            instrumentType: 'prop-payout',
                            amount,
                            description: desc,
                            confidence: 90
                        });
                    }
                }
            });
        } catch (err) {
            results.errors.push(`Payment Platform Exception: ${err.message}`);
        }

        return results;
    }

    /**
     * Ingest Crypto Exchange CSV (Binance, Bybit, Coinbase)
     */
    function parseCryptoExchange(content, fileName = 'Crypto_Export.csv') {
        const results = { trades: [], errors: [] };
        if (!content || typeof content !== 'string') {
            results.errors.push('Invalid crypto content.');
            return results;
        }

        try {
            const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            lines.forEach((line, idx) => {
                const parts = line.split(/[,;\t]/).map(p => p.replace(/^"|"$/g, '').trim());
                if (parts.length >= 4) {
                    const date = parts[0];
                    const symbol = parts[1] || 'BTCUSDT';
                    const side = (parts[2] || 'BUY').toUpperCase();
                    const pnl = parseFloat(parts[parts.length - 1]) || 0;

                    if (!isNaN(pnl) && date.match(/202[0-9]/)) {
                        results.trades.push({
                            id: `CRYPTO-${idx}`,
                            date,
                            source: 'Crypto Exchange',
                            instrumentType: 'crypto',
                            symbol,
                            type: side,
                            amount: pnl,
                            description: `Crypto ${side} ${symbol}`,
                            confidence: 90
                        });
                    }
                }
            });
        } catch (err) {
            results.errors.push(`Crypto Exchange Exception: ${err.message}`);
        }

        return results;
    }

    return {
        parseMT4HTML,
        parseCSVStatement,
        parsePropPayout,
        parsePaymentPlatform,
        parseCryptoExchange,
        isMetaTraderRawStatement,
        calculateConfidence
    };
})();
