/**
 * Reconcilr Multi-Format Exporter Module (CSV, Excel .xlsx, PDF/Print)
 */

window.ReconcilrExporter = (function () {

    const LEGAL_NOTICE = 'Trade Ledger compiles trader-provided data for accountant reference or self-filing. It is not a tax filing service, tax advisor, or source of prescriptive tax-saving advice.';
    const ATTESTATION = 'I confirm this data is accurate to the best of my knowledge.';

    function canExport(consolidatedData) {
        if (!consolidatedData || !consolidatedData.attestationConfirmed) {
            alert('Confirm the accuracy attestation before exporting.');
            return false;
        }
        if (!consolidatedData.selectedCountries || consolidatedData.selectedCountries.length === 0) {
            alert('Select every country where you file before exporting.');
            return false;
        }
        return true;
    }

    function escapeHTML(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Export Consolidated Ledger as CSV
     */
    function exportCSV(consolidatedData) {
        if (!canExport(consolidatedData)) return;
        const { categorizedItems } = consolidatedData;
        if (!categorizedItems || categorizedItems.length === 0) {
            alert('No items in ledger to export.');
            return;
        }

        const headers = ['ID/Ticket', 'Date', 'Source', 'Instrument Type', 'Description', 'Amount (USD)', 'Confidence Score', 'Jurisdiction Tax Tags'];
        const rows = [
            ['TRADE LEDGER ACCOUNTANT REFERENCE EXPORT'],
            ['Legal Notice', LEGAL_NOTICE],
            ['Attestation', consolidatedData.attestationText || ATTESTATION],
            [],
            headers
        ];

        categorizedItems.forEach(item => {
            const tagsStr = (item.jurisdictionTags || []).map(t => `${t.countryName}: ${t.taxHead}`).join(' | ');
            rows.push([
                `"${item.id || ''}"`,
                `"${item.date || ''}"`,
                `"${item.source || ''}"`,
                `"${item.instrumentType || ''}"`,
                `"${(item.description || item.symbol || '').replace(/"/g, '""')}"`,
                item.amount || 0,
                `${item.confidence || 100}%`,
                `"${tagsStr}"`
            ]);
        });

        const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Trade_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Export Excel (.xlsx) using SheetJS
     */
    function exportExcel(consolidatedData) {
        if (!canExport(consolidatedData)) return;
        if (!window.XLSX) {
            alert('SheetJS Library loading. Please try again.');
            return;
        }

        const { categorizedItems, metrics, countryLiabilityEstimates } = consolidatedData;
        const wb = XLSX.utils.book_new();

        // 1. Cover Sheet & Estimates
        const coverRows = [
            ['TRADE LEDGER - GLOBAL RECONCILIATION PACK'],
            ['Export Date:', new Date().toLocaleString()],
            ['Legal Notice:', LEGAL_NOTICE],
            ['Attestation:', consolidatedData.attestationText || ATTESTATION],
            [''],
            ['ESTIMATED TAX LIABILITY RANGES BY SELECTED JURISDICTION'],
            ['Jurisdiction', 'Consolidated Net P&L (Local)', 'Estimated Tax Liability Range', 'CPA Reference Disclaimer']
        ];

        countryLiabilityEstimates.forEach(cle => {
            coverRows.push([cle.countryName, cle.localNet, cle.estimatedRange, cle.disclaimer]);
        });

        coverRows.push(['']);
        coverRows.push(['CONSOLIDATED TOTALS (USD)']);
        coverRows.push(['Total Gross Profit:', metrics.totalGrossProfitUSD]);
        coverRows.push(['Total Expenses / Charges:', metrics.totalExpensesUSD]);
        coverRows.push(['Consolidated Net P&L:', metrics.totalNetUSD]);

        const wsCover = XLSX.utils.aoa_to_sheet(coverRows);
        XLSX.utils.book_append_sheet(wb, wsCover, 'Cover Sheet');

        // 2. Full Ledger Sheet
        const ledgerHeaders = ['ID / Ticket', 'Date', 'Source Platform', 'Instrument Type', 'Symbol / Details', 'Amount (USD)', 'Confidence Score', 'Jurisdiction Rule Tags'];
        const ledgerRows = [ledgerHeaders];

        categorizedItems.forEach(i => {
            const tags = (i.jurisdictionTags || []).map(t => `${t.countryKey}: ${t.taxHead} (${t.form})`).join('; ');
            ledgerRows.push([
                i.id,
                i.date,
                i.source,
                i.instrumentType,
                i.symbol || i.description || 'P&L Line',
                i.amount,
                `${i.confidence || 100}%`,
                tags
            ]);
        });

        const wsLedger = XLSX.utils.aoa_to_sheet(ledgerRows);
        XLSX.utils.book_append_sheet(wb, wsLedger, 'Consolidated Ledger');

        const payoutRows = [['ID / Ticket', 'Date', 'Source Platform', 'Description', 'Amount (USD)', 'Confidence Score', 'Jurisdiction Rule Tags']];
        categorizedItems
            .filter(i => i.instrumentType === 'prop-payout')
            .forEach(i => {
                payoutRows.push([
                    i.id,
                    i.date,
                    i.source,
                    i.description || i.symbol || 'Prop-firm payout',
                    i.amount,
                    `${i.confidence || 100}%`,
                    (i.jurisdictionTags || []).map(t => `${t.countryKey}: ${t.taxHead}`).join('; ')
                ]);
            });
        if (payoutRows.length === 1) payoutRows.push(['No prop-firm payout records in this export.']);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(payoutRows), 'Prop-Firm Payouts');

        const reconciliationRows = [
            ['RECONCILIATION SUMMARY'],
            ['Ledger lines', metrics.totalCount],
            ['Gross profit (USD)', metrics.totalGrossProfitUSD],
            ['Expenses / charges (USD)', metrics.totalExpensesUSD],
            ['Net P&L (USD)', metrics.totalNetUSD],
            [],
            ['ITEM-LEVEL RECONCILIATION'],
            ['ID / Ticket', 'Source', 'Amount (USD)', 'Confidence Score', 'Review Note']
        ];
        categorizedItems.forEach(i => reconciliationRows.push([
            i.id,
            i.source,
            i.amount,
            `${i.confidence || 100}%`,
            i.confidence < 100 ? 'Review imported or manually edited value.' : 'Source record parsed without a manual edit flag.'
        ]));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(reconciliationRows), 'Reconciliation');

        XLSX.writeFile(wb, `Trade_Ledger_Accountant_Pack_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    /**
     * Open Printable Accountant Report PDF Window
     */
    function printAccountantPDF(consolidatedData) {
        if (!canExport(consolidatedData)) return;
        const { categorizedItems, metrics, countryLiabilityEstimates } = consolidatedData;
        const printWin = window.open('', '_blank', 'width=900,height=800');
        
        let rowsHtml = '';
        categorizedItems.forEach(i => {
            const tags = (i.jurisdictionTags || []).map(t => `<strong>${escapeHTML(t.countryKey)}:</strong> ${escapeHTML(t.taxHead)}`).join('<br>');
            rowsHtml += `
                <tr>
                    <td>#${escapeHTML(i.id)}</td>
                    <td>${escapeHTML(i.date)}</td>
                    <td>${escapeHTML(i.source)}</td>
                    <td><span class="badge">${escapeHTML(i.instrumentType)}</span></td>
                    <td class="${i.amount >= 0 ? 'pos' : 'neg'}">$${(i.amount || 0).toFixed(2)}</td>
                    <td><span class="conf">${i.confidence || 100}%</span></td>
                    <td style="font-size:11px;">${tags}</td>
                </tr>
            `;
        });

        let estHtml = '';
        countryLiabilityEstimates.forEach(cle => {
            estHtml += `
                <div style="border:1px solid #000; padding:12px; margin-bottom:10px;">
                    <strong>${cle.countryName} (${cle.currency}):</strong> Net P&L: ${cle.currency} ${cle.localNet.toLocaleString('en-US')}<br>
                    <strong>Estimated Tax Range:</strong> ${cle.estimatedRange}<br>
                    <small><em>${cle.disclaimer}</em></small>
                </div>
            `;
        });

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Trade Ledger Accountant Pack Report</title>
                <style>
                    body { font-family: sans-serif; padding: 24px; color: #000; }
                    h1 { font-family: serif; margin-bottom: 4px; }
                    .header { border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
                    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                    th { background: #f0f0f0; }
                    .pos { color: green; font-weight: bold; }
                    .neg { color: red; font-weight: bold; }
                    .badge { font-family: monospace; background: #eee; padding: 2px 6px; }
                    .disclaimer { border: 1px solid #c92a2a; background: #fff5f5; color: #c92a2a; padding: 12px; margin-top: 24px; font-size: 11px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>TRADE LEDGER ACCOUNTANT PACK</h1>
                    <div>Generated: ${new Date().toLocaleString()} • Data Compilation & Reference Layer</div>
                </div>

                <div class="disclaimer" style="margin-top:0; margin-bottom:24px;">
                    <strong>LEGAL NOTICE:</strong> ${LEGAL_NOTICE}<br><br>
                    <strong>ATTESTATION:</strong> ${consolidatedData.attestationText || ATTESTATION}
                </div>

                <h3>JURISDICTION ESTIMATED TAX LIABILITY RANGES</h3>
                ${estHtml}

                <h3>CONSOLIDATED LEDGER RECORDS (${categorizedItems.length} LINES)</h3>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th><th>Date</th><th>Source</th><th>Type</th><th>Net P&L</th><th>Confidence</th><th>Jurisdiction Tags</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <div class="disclaimer">
                    <strong>ESTIMATE NOTICE:</strong> Every tax range is an estimate — verify with a licensed accountant in the applicable filing country.
                </div>
                <script>window.print();</script>
            </body>
            </html>
        `;

        printWin.document.write(html);
        printWin.document.close();
    }

    return {
        exportCSV,
        exportExcel,
        printAccountantPDF
    };
})();
