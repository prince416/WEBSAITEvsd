/**
 * Automated Standalone Unit Test Suite for Reconcilr Statement Parsers
 * Uses pure Node.js stdlib (Zero external dependencies)
 * Run: node tests/parser.test.js
 */

const assert = require('assert');

// Simple Regex HTML Table parser mock for pure Node testing
if (typeof window === 'undefined') {
    global.window = {};
    global.DOMParser = class {
        parseFromString(htmlString) {
            return {
                querySelectorAll: (selector) => {
                    if (selector === 'table tr') {
                        const trMatches = htmlString.match(/<tr[\s\S]*?<\/tr>/gi) || [];
                        return trMatches.map(trHtml => ({
                            querySelectorAll: (cellSel) => {
                                const tdMatches = trHtml.match(/<td[\s\S]*?<\/td>/gi) || [];
                                return tdMatches.map(tdHtml => ({
                                    innerText: tdHtml.replace(/<[^>]+>/g, '').trim()
                                }));
                            }
                        }));
                    }
                    return [];
                },
                querySelector: (selector) => {
                    const bMatch = htmlString.match(/<b>([\s\S]*?)<\/b>/i);
                    return bMatch ? { innerText: bMatch[1] } : null;
                }
            };
        }
    };
}

const fs = require('fs');
const path = require('path');

// Load Unified Parsers module code
const parserCode = fs.readFileSync(path.join(__dirname, '../js/parsers/unified-parsers.js'), 'utf8');
eval(parserCode);

const reconciliationCode = fs.readFileSync(path.join(__dirname, '../js/engine/reconciliation.js'), 'utf8');
eval(reconciliationCode);

const Parsers = global.window.UnifiedParsers;
const ReconciliationEngine = global.window.ReconciliationEngine;

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        passedTests++;
        console.log(`  ✓ PASS: ${name}`);
    } catch (err) {
        console.error(`  ✗ FAIL: ${name}`);
        console.error(`    ${err.stack || err.message}`);
    }
}

console.log('Running Reconcilr Statement Parser Unit Tests...\n');

// 1. MT4/MT5 raw statements must be rejected
runTest('Raw MetaTrader Statements Are Rejected', () => {
    const htmlSample = `
        <html><body><table>
        <tr><td colspan="14"><b>Account: 884920 (Broker-Live)</b></td></tr>
        <tr><td colspan="14"><b>Closed Transactions:</b></td></tr>
        <tr><td>7194012</td><td>2026.08.01 10:14</td><td>buy</td><td>2.00</td><td>EURUSD</td><td>1.0850</td><td>0</td><td>0</td><td>2026.08.01 14:30</td><td>1.0895</td><td>-14.00</td><td>0.00</td><td>-2.40</td><td>1420.00</td></tr>
        </table></body></html>
    `;
    const res = Parsers.parseMT4HTML(htmlSample, 'test.html');
    assert.strictEqual(res.trades.length, 0, 'Raw statement rows must not be imported');
    assert.match(res.errors[0], /not accepted/i, 'Should explain the rejection');
});

// 2. Accepted broker CSV ingestion
runTest('Broker CSV Ingestion & Asset Type Categorization', () => {
    const csvSample = `
        Account: 104928
        Deal,Date,Type,Symbol,Size,Price,Commission,Swap,Profit
        1001,2026-08-05 12:30:00,buy,BTCUSD,0.10,64200.00,-2.50,-1.10,380.00
    `;
    const res = Parsers.parseCSVStatement(csvSample, 'test.csv');
    assert.strictEqual(res.trades.length, 1, 'Should extract 1 crypto trade');
    assert.strictEqual(res.trades[0].instrumentType, 'crypto', 'Should identify instrument as crypto');
    assert.strictEqual(res.trades[0].confidence, 100, 'Confidence should be 100');
});

runTest('MetaTrader-Named CSV Is Rejected', () => {
    const csvSample = 'Deal,Date,Type,Symbol,Profit\n1001,2026-08-05,buy,BTCUSD,380.00';
    const res = Parsers.parseCSVStatement(csvSample, 'MT5_statement.csv');
    assert.strictEqual(res.trades.length, 0, 'MetaTrader raw statement filenames must not be imported');
    assert.match(res.errors[0], /not accepted/i, 'Should explain the rejection');
});

// 3. Prop Firm Payout Ingestion Test
runTest('Prop Firm Payout Statement Ingestion', () => {
    const propText = `
        INSTANT FUNDING - PAYOUT RECEIPT
        Date: 2026-08-15
        Account: PF-99381
        Payout Amount: $3,450.00
    `;
    const res = Parsers.parsePropPayout(propText, 'payout.txt');
    assert.strictEqual(res.payouts.length, 1, 'Should extract 1 payout');
    assert.strictEqual(res.payouts[0].amount, 3450.00, 'Amount should be 3450.00');
    assert.strictEqual(res.payouts[0].confidence, 95, 'Confidence score should be 95');
});

// 4. Payment Platforms (Rise/Deel)
runTest('Payment Platform Ingestion (Deel/Rise)', () => {
    const deelCsv = `
        2026-08-13,Deel Prop Payout Transfer,5200.00
    `;
    const res = Parsers.parsePaymentPlatform(deelCsv, 'deel.csv');
    assert.strictEqual(res.payments.length, 1, 'Should extract 1 payment record');
    assert.strictEqual(res.payments[0].amount, 5200.00, 'Amount should be 5200.00');
});

// 5. Input Validation & Error Handling
runTest('Malformed & Empty File Graceful Handling', () => {
    const emptyRes = Parsers.parseMT4HTML('', 'empty.html');
    assert.strictEqual(emptyRes.errors.length, 1, 'Should report rejection for unsupported statement type');
    assert.strictEqual(emptyRes.trades.length, 0, 'No trades should crash app');

    const garbageRes = Parsers.parseCSVStatement('INVALID_GARBAGE_LINE_123', 'bad.csv');
    assert.strictEqual(garbageRes.trades.length, 0, 'Garbage text should yield 0 trades cleanly without crash');
});

// 6. Jurisdiction reference mapping
runTest('EU / Global Mapping Uses Its Own Country-Specific Reference Rule', () => {
    const result = ReconciliationEngine.consolidateLedger([
        { id: 'MANUAL-1', date: '2026-08-15', source: 'Manual', instrumentType: 'crypto', amount: 1000 }
    ], ['EU']);
    const tag = result.categorizedItems[0].jurisdictionTags[0];
    assert.strictEqual(tag.countryKey, 'EU', 'EU should not fall back to the US rule set');
    assert.strictEqual(tag.currency, 'EUR', 'EU reference output should use EUR');
    assert.match(result.countryLiabilityEstimates[0].estimatedRange, /verify with a licensed accountant/i);
});

runTest('No Jurisdiction Is Inferred When None Is Selected', () => {
    const result = ReconciliationEngine.consolidateLedger([
        { id: 'MANUAL-2', date: '2026-08-15', source: 'Manual', instrumentType: 'forex', amount: 1000 }
    ], []);
    assert.strictEqual(result.countryLiabilityEstimates.length, 0, 'No country estimate should be inferred');
    assert.strictEqual(result.categorizedItems[0].jurisdictionTags.length, 0, 'No country tag should be inferred');
});

console.log(`\nTest Summary: ${passedTests}/${totalTests} Passed Cleanly.\n`);
if (passedTests === totalTests) {
    process.exit(0);
} else {
    process.exit(1);
}
