/**
 * Main UI & Application Controller for CA Layer Platform
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // Application State
    const state = {
        ingestedFiles: [],
        statements: [],
        propPayouts: [],
        consolidated: null,
        selectedCurrency: 'INR',
        searchQuery: '',
        filterAccount: 'ALL',
        filterCategory: 'ALL'
    };

    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const fileStatusBar = document.getElementById('file-status-bar');
    const fileChipContainer = document.getElementById('file-chip-container');
    const ingestedCount = document.getElementById('ingested-count');
    const btnClearAll = document.getElementById('btn-clear-all');
    const btnExportTop = document.getElementById('btn-export-top');
    const btnExportMain = document.getElementById('btn-export-main');
    const btnDemoSamples = document.getElementById('btn-demo-samples');
    const currencySelect = document.getElementById('currency-select');

    // Metrics DOM
    const valNetPnL = document.getElementById('val-net-pnl');
    const subNetPnL = document.getElementById('sub-net-pnl');
    const valPropPayouts = document.getElementById('val-prop-payouts');
    const valSpecPnL = document.getElementById('val-spec-pnl');
    const valFoPnL = document.getElementById('val-fo-pnl');

    // Tables DOM
    const tbodyTaxSummary = document.getElementById('tbody-tax-summary');
    const tbodyTrades = document.getElementById('tbody-trades');
    const tbodyPayouts = document.getElementById('tbody-payouts');
    const tbodyAccounts = document.getElementById('tbody-accounts');
    const healthCheckList = document.getElementById('health-check-list');

    const tradeCountSpan = document.getElementById('trade-count');
    const payoutCountSpan = document.getElementById('payout-count');

    const searchTrades = document.getElementById('search-trades');
    const filterAccount = document.getElementById('filter-account');
    const filterCategory = document.getElementById('filter-category');

    // ---------------------------------------------------------
    // Event Listeners Initialization
    // ---------------------------------------------------------
    
    // Dropzone Drag & Drop
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('drag-over');
        }, false);
    });

    dropzone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer.files);
        handleFilesUpload(files);
    });

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        handleFilesUpload(files);
    });

    // Sample buttons
    document.querySelectorAll('.chip-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sampleKey = btn.getAttribute('data-sample');
            loadSampleByKey(sampleKey);
        });
    });

    btnDemoSamples.addEventListener('click', () => {
        loadAllDemoSamples();
    });

    btnClearAll.addEventListener('click', () => {
        clearAllState();
    });

    // Currency Switcher
    currencySelect.addEventListener('change', (e) => {
        state.selectedCurrency = e.target.value;
        recalculateAndRender();
    });

    // Filtering & Searching
    searchTrades.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase();
        renderTradesTable();
    });

    filterAccount.addEventListener('change', (e) => {
        state.filterAccount = e.target.value;
        renderTradesTable();
    });

    filterCategory.addEventListener('change', (e) => {
        state.filterCategory = e.target.value;
        renderTradesTable();
    });

    // Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetTab = btn.getAttribute('data-tab');
            document.getElementById(targetTab).classList.add('active');
        });
    });

    // Export Action
    [btnExportTop, btnExportMain].forEach(btn => {
        btn.addEventListener('click', () => {
            if (state.consolidated) {
                window.CAExcelGenerator.generateCAWorkbook(state.consolidated);
            }
        });
    });

    // ---------------------------------------------------------
    // Ingestion Pipeline Logic
    // ---------------------------------------------------------

    function handleFilesUpload(files) {
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                processFileContent(file.name, content);
            };
            reader.readAsText(file);
        });
    }

    function processFileContent(fileName, content) {
        const lowerName = fileName.toLowerCase();
        
        // Detect File Type
        if (lowerName.endsWith('.html') || lowerName.endsWith('.htm') || content.includes('Closed Transactions:')) {
            const parsed = window.MTParser.parseMT4HTML(content, fileName);
            state.statements.push(parsed);
            state.ingestedFiles.push({ name: fileName, type: 'MT4 HTML', count: parsed.trades.length });
        } else if (lowerName.endsWith('.csv') && !lowerName.includes('payout')) {
            const parsed = window.MTParser.parseMT5CSV(content, fileName);
            state.statements.push(parsed);
            state.ingestedFiles.push({ name: fileName, type: 'MT5 CSV', count: parsed.trades.length });
        } else {
            // Default to Prop Payout Parser
            const payouts = window.PropPayoutParser.parsePayoutStatement(content, fileName);
            if (payouts.length > 0) {
                state.propPayouts = state.propPayouts.concat(payouts);
                state.ingestedFiles.push({ name: fileName, type: 'Prop Payout', count: payouts.length });
            }
        }

        recalculateAndRender();
    }

    function loadSampleByKey(key) {
        const sample = window.SampleDataProvider.SAMPLES[key];
        if (sample) {
            processFileContent(sample.name, sample.content);
        }
    }

    function loadAllDemoSamples() {
        clearAllState();
        Object.keys(window.SampleDataProvider.SAMPLES).forEach(key => {
            loadSampleByKey(key);
        });
    }

    function clearAllState() {
        state.ingestedFiles = [];
        state.statements = [];
        state.propPayouts = [];
        state.consolidated = null;
        fileInput.value = '';

        recalculateAndRender();
    }

    // ---------------------------------------------------------
    // Recalculation & Rendering Engine
    // ---------------------------------------------------------

    function recalculateAndRender() {
        // Run Reconciliation Engine
        state.consolidated = window.ReconciliationEngine.consolidateData(state.statements, state.propPayouts, state.selectedCurrency);
        
        // Update Account Filter Options
        updateAccountFilterOptions();

        // Render UI Sections
        renderFileChips();
        renderMetrics();
        renderTaxSummaryTable();
        renderHealthChecks();
        renderTradesTable();
        renderPayoutsTable();
        renderAccountsTable();

        // Enable/Disable Export buttons
        const hasData = (state.consolidated.allTrades.length > 0 || state.consolidated.allPayouts.length > 0);
        btnExportTop.disabled = !hasData;
        btnExportMain.disabled = !hasData;
    }

    function renderFileChips() {
        if (state.ingestedFiles.length === 0) {
            fileStatusBar.classList.add('hidden');
            return;
        }

        fileStatusBar.classList.remove('hidden');
        ingestedCount.innerText = state.ingestedFiles.length;
        fileChipContainer.innerHTML = '';

        state.ingestedFiles.forEach(f => {
            const chip = document.createElement('div');
            chip.className = 'file-chip';
            chip.innerHTML = `<i data-lucide="file-text"></i> <span>${f.name} (${f.type})</span>`;
            fileChipContainer.appendChild(chip);
        });
        
        if (window.lucide) window.lucide.createIcons();
    }

    function renderMetrics() {
        const m = state.consolidated.metrics;
        const isINR = (state.selectedCurrency === 'INR');
        const currSymbol = isINR ? '₹' : (state.selectedCurrency === 'EUR' ? '€' : '$');
        const mult = isINR ? 1 : (state.selectedCurrency === 'EUR' ? 0.92 / 83.50 : 1 / 83.50);

        valNetPnL.innerText = `${currSymbol}${(m.totalNetINR * mult).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        subNetPnL.innerText = `From ${m.totalTradeCount} trades & ${m.totalPayoutCount} payouts`;

        valPropPayouts.innerText = `${currSymbol}${(m.propGrossINR * mult).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        valSpecPnL.innerText = `${currSymbol}${(m.specNetINR * mult).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        valFoPnL.innerText = `${currSymbol}${(m.foNetINR * mult).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        tradeCountSpan.innerText = m.totalTradeCount;
        payoutCountSpan.innerText = m.totalPayoutCount;
    }

    function renderTaxSummaryTable() {
        tbodyTaxSummary.innerHTML = '';
        const rows = state.consolidated.taxSummaryRows;
        const isINR = (state.selectedCurrency === 'INR');
        const mult = isINR ? 1 : 1 / 83.50;
        const currPrefix = isINR ? '₹' : '$';

        if (rows.length === 0 || (state.consolidated.allTrades.length === 0 && state.consolidated.allPayouts.length === 0)) {
            tbodyTaxSummary.innerHTML = `<tr><td colspan="6" class="text-center empty-state">No statements uploaded yet. Load samples or drag & drop statements above.</td></tr>`;
            return;
        }

        rows.forEach(r => {
            const tr = document.createElement('tr');
            const gross = r.grossVolINR * mult;
            const exp = r.expensesINR * mult;
            const net = r.netINR * mult;

            tr.innerHTML = `
                <td><strong>${r.category}</strong></td>
                <td><span class="val-mono">${r.head}</span></td>
                <td class="val-mono">${currPrefix}${gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td class="val-mono">${currPrefix}${exp.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td class="val-mono ${net >= 0 ? 'val-positive' : 'val-negative'}">${currPrefix}${net.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td><span class="badge badge-speculative">${r.status}</span></td>
            `;
            tbodyTaxSummary.appendChild(tr);
        });
    }

    function renderHealthChecks() {
        healthCheckList.innerHTML = '';
        state.consolidated.healthChecks.forEach(hc => {
            const li = document.createElement('li');
            li.className = `check-item ${hc.type}`;
            const icon = hc.type === 'pass' ? 'check-circle' : (hc.type === 'warn' ? 'alert-triangle' : 'help-circle');
            li.innerHTML = `<i data-lucide="${icon}"></i> <span>${hc.message}</span>`;
            healthCheckList.appendChild(li);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    function renderTradesTable() {
        tbodyTrades.innerHTML = '';
        let trades = state.consolidated.allTrades;

        // Apply Search
        if (state.searchQuery) {
            trades = trades.filter(t => 
                t.ticket.toString().includes(state.searchQuery) ||
                t.symbol.toLowerCase().includes(state.searchQuery) ||
                t.broker.toLowerCase().includes(state.searchQuery) ||
                t.accountNumber.toLowerCase().includes(state.searchQuery)
            );
        }

        // Apply Account Filter
        if (state.filterAccount !== 'ALL') {
            trades = trades.filter(t => t.accountNumber === state.filterAccount);
        }

        // Apply Category Filter
        if (state.filterCategory !== 'ALL') {
            trades = trades.filter(t => t.taxCategory === state.filterCategory);
        }

        if (trades.length === 0) {
            tbodyTrades.innerHTML = `<tr><td colspan="9" class="text-center empty-state">No matching trades found.</td></tr>`;
            return;
        }

        const isINR = (state.selectedCurrency === 'INR');
        const mult = isINR ? 83.50 : 1;
        const currPrefix = isINR ? '₹' : '$';

        trades.slice(0, 100).forEach(t => {
            const tr = document.createElement('tr');
            const net = t.netPnL * mult;
            const gross = t.grossProfit * mult;
            const comm = (t.commission + t.swap) * mult;

            let badgeClass = 'badge-speculative';
            if (t.taxCategory === 'F&O / Derivatives') badgeClass = 'badge-fo';
            if (t.taxCategory === 'Capital / Transfer') badgeClass = 'badge-transfer';

            tr.innerHTML = `
                <td class="val-mono">#${t.ticket}</td>
                <td><strong>${t.accountNumber}</strong><br><small class="text-dim">${t.broker}</small></td>
                <td>${t.openTime}<br><small class="text-dim">${t.closeTime}</small></td>
                <td><strong>${t.type}</strong> ${t.symbol}</td>
                <td class="val-mono">${t.size}</td>
                <td class="val-mono">${currPrefix}${gross.toFixed(2)}</td>
                <td class="val-mono">${currPrefix}${comm.toFixed(2)}</td>
                <td class="val-mono ${net >= 0 ? 'val-positive' : 'val-negative'}">${currPrefix}${net.toFixed(2)}</td>
                <td><span class="badge ${badgeClass}">${t.taxCategory}</span></td>
            `;
            tbodyTrades.appendChild(tr);
        });
    }

    function renderPayoutsTable() {
        tbodyPayouts.innerHTML = '';
        const payouts = state.consolidated.allPayouts;

        if (payouts.length === 0) {
            tbodyPayouts.innerHTML = `<tr><td colspan="8" class="text-center empty-state">No prop firm payouts recorded.</td></tr>`;
            return;
        }

        payouts.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="val-mono">${p.payoutDate}</td>
                <td><strong>${p.propFirm}</strong></td>
                <td class="val-mono">${p.accountRef}</td>
                <td>${p.paymentMethod}</td>
                <td class="val-mono">$${p.originalAmount.toFixed(2)} USD</td>
                <td class="val-mono val-positive">₹${p.inrValue.toLocaleString('en-IN')}</td>
                <td><span class="badge badge-prop">${p.taxHead}</span></td>
                <td><span class="val-positive"><i data-lucide="check-circle-2"></i> ${p.verificationStatus}</span></td>
            `;
            tbodyPayouts.appendChild(tr);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    function renderAccountsTable() {
        tbodyAccounts.innerHTML = '';
        const accs = state.consolidated.accountSummaries;

        if (accs.length === 0) {
            tbodyAccounts.innerHTML = `<tr><td colspan="8" class="text-center empty-state">No accounts detected.</td></tr>`;
            return;
        }

        accs.forEach(a => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${a.accountNumber}</strong></td>
                <td>${a.broker}</td>
                <td><span class="badge badge-speculative">${a.platform}</span></td>
                <td class="val-mono">$${a.initDeposit.toFixed(2)}</td>
                <td class="val-mono ${a.netTradePnL >= 0 ? 'val-positive' : 'val-negative'}">$${a.netTradePnL.toFixed(2)}</td>
                <td class="val-mono">$${a.totalWithdrawals.toFixed(2)}</td>
                <td class="val-mono">$${a.endingBalance.toFixed(2)}</td>
                <td><span class="val-positive"><i data-lucide="shield-check"></i> ${a.reconciled}</span></td>
            `;
            tbodyAccounts.appendChild(tr);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    function updateAccountFilterOptions() {
        const currentVal = filterAccount.value;
        filterAccount.innerHTML = `<option value="ALL">All Accounts</option>`;
        
        const accounts = [...new Set(state.consolidated.allTrades.map(t => t.accountNumber))];
        accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc;
            opt.innerText = acc;
            filterAccount.appendChild(opt);
        });

        filterAccount.value = currentVal;
    }

    // Load Demo Samples by default on boot
    loadAllDemoSamples();

});
