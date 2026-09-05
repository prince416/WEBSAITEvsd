/**
 * Reconcilr Product Workspace Controller
 * Controls file ingestion, tax jurisdiction calculations, editable ledger,
 * plan gating (Weekly vs Monthly), free trial usage, and manual crypto pass checkout.
 */

document.addEventListener('DOMContentLoaded', () => {

    // 1. Session & Auth Check Guard
    const storedSession = localStorage.getItem('trade_ledger_session');
    if (!storedSession && window.TradeLedgerAuth && !window.TradeLedgerAuth.client) {
        // Redirect unauthenticated visitors to login
        window.location.href = 'login.html?mode=signin';
        return;
    }

    let userEmail = 'trader@example.com';
    try {
        if (storedSession) {
            const parsed = JSON.parse(storedSession);
            userEmail = parsed.user?.email || userEmail;
        }
    } catch (e) {}

    const emailDisplay = document.getElementById('user-email-display');
    if (emailDisplay) emailDisplay.textContent = userEmail;

    // Logout button handler
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (window.TradeLedgerAuth) window.TradeLedgerAuth.logout();
            else {
                localStorage.removeItem('trade_ledger_session');
                window.location.href = 'index.html';
            }
        });
    }

    // Application Workspace State
    const state = {
        ingestedItems: [],
        selectedCountries: [],
        consolidatedResult: null,
        attestationConfirmed: false,
        ingestionErrors: []
    };

    // DOM Elements - Workspace
    const wsDropzone = document.getElementById('ws-dropzone');
    const wsFileInput = document.getElementById('ws-file-input');
    const btnLoadSamples = document.getElementById('btn-load-all-samples');
    const wsTbodyLedger = document.getElementById('ws-tbody-ledger');
    const wsLineCount = document.getElementById('ws-line-count');
    const wsCountryEstimates = document.getElementById('ws-country-estimates');
    const manualEntryForm = document.getElementById('manual-entry-form');
    const ingestionErrorsBox = document.getElementById('ws-ingestion-errors');
    const attestationCheckbox = document.getElementById('ws-attestation');

    const btnExportCSV = document.getElementById('btn-export-csv');
    const btnExportExcel = document.getElementById('btn-export-excel');
    const btnExportPDF = document.getElementById('btn-export-pdf');

    const passStatusPill = document.getElementById('pass-status-pill');
    const passStatusText = document.getElementById('pass-status-text');
    const workspaceNoticeBar = document.getElementById('workspace-notice-bar');
    const noticeText = document.getElementById('notice-text');
    const noticeActionBtn = document.getElementById('notice-action-btn');
    const btnRenewPass = document.getElementById('btn-renew-pass');

    // ---------------------------------------------------------
    // 2. Plan & Free Trial Status Management
    // ---------------------------------------------------------

    function updatePassStatusUI() {
        if (!window.TradeLedgerAuth) return;
        const userState = window.TradeLedgerAuth.getUserState();
        const activePass = window.TradeLedgerAuth.getActivePass();

        if (activePass) {
            const daysLeft = Math.ceil((activePass.expiryTimestamp - Date.now()) / (1000 * 60 * 60 * 24));
            if (passStatusText) passStatusText.textContent = `${activePass.planName} Active (${daysLeft} days remaining)`;
            if (passStatusPill) {
                passStatusPill.style.borderColor = 'var(--accent-green)';
                passStatusPill.querySelector('.pill-dot').style.background = 'var(--accent-green)';
            }
            if (workspaceNoticeBar) workspaceNoticeBar.classList.add('hidden');
        } else if (userState.freeReportsUsed < window.TradeLedgerConfig.freeTrial.maxFreeReports) {
            const freeLeft = window.TradeLedgerConfig.freeTrial.maxFreeReports - userState.freeReportsUsed;
            if (passStatusText) passStatusText.textContent = `Free Trial (${freeLeft} Report Generation Remaining)`;
            if (passStatusPill) {
                passStatusPill.style.borderColor = 'var(--accent-gold)';
                passStatusPill.querySelector('.pill-dot').style.background = 'var(--accent-gold)';
            }
            if (workspaceNoticeBar) workspaceNoticeBar.classList.add('hidden');
        } else {
            if (passStatusText) passStatusText.textContent = 'Access Expired — Renew Pass Required';
            if (passStatusPill) {
                passStatusPill.style.borderColor = 'var(--stamp-red)';
                passStatusPill.querySelector('.pill-dot').style.background = 'var(--stamp-red)';
            }
            if (workspaceNoticeBar && noticeText) {
                noticeText.textContent = 'Your 1 free trial report has been generated. Upgrade to a Weekly ($4.99) or Monthly ($9.99) pass to export further reports.';
                workspaceNoticeBar.classList.remove('hidden');
            }
        }

        renderExportState();
    }

    updatePassStatusUI();
    if (btnRenewPass) btnRenewPass.addEventListener('click', openCryptoModal);
    if (noticeActionBtn) noticeActionBtn.addEventListener('click', openCryptoModal);

    // ---------------------------------------------------------
    // 3. File Ingestion & Drag Drop
    // ---------------------------------------------------------

    if (wsDropzone && wsFileInput) {
        ['dragenter', 'dragover'].forEach(name => {
            wsDropzone.addEventListener(name, (e) => { e.preventDefault(); wsDropzone.style.background = '#f3eee3'; });
        });
        ['dragleave', 'drop'].forEach(name => {
            wsDropzone.addEventListener(name, (e) => { e.preventDefault(); wsDropzone.style.background = 'var(--paper-bg)'; });
        });

        wsDropzone.addEventListener('drop', (e) => {
            const files = Array.from(e.dataTransfer.files);
            handleUploadedFiles(files);
        });

        wsFileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            handleUploadedFiles(files);
        });
    }

    if (btnLoadSamples) {
        btnLoadSamples.addEventListener('click', () => {
            state.ingestedItems = [];
            loadAllSyntheticSamples();
        });
    }

    function handleUploadedFiles(files) {
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                processFile(file.name, content);
            };
            reader.readAsText(file);
        });
    }

    function processFile(fileName, content) {
        const lower = fileName.toLowerCase();
        let parsed = { trades: [], deposits: [], payouts: [], payments: [] };

        if (window.UnifiedParsers.isMetaTraderRawStatement(content, fileName)) {
            parsed = window.UnifiedParsers.parseMT4HTML(content, fileName);
        } else if (lower.includes('payout') || lower.includes('receipt')) {
            parsed = window.UnifiedParsers.parsePropPayout(content, fileName);
        } else if (lower.includes('deel') || lower.includes('rise') || lower.includes('wise')) {
            parsed = window.UnifiedParsers.parsePaymentPlatform(content, fileName);
        } else if (lower.includes('crypto') || lower.includes('binance') || lower.includes('bybit')) {
            parsed = window.UnifiedParsers.parseCryptoExchange(content, fileName);
        } else {
            parsed = window.UnifiedParsers.parseCSVStatement(content, fileName);
        }

        if (parsed.errors && parsed.errors.length) {
            state.ingestionErrors = state.ingestionErrors.concat(parsed.errors.map(error => `${fileName}: ${error}`));
            renderIngestionErrors();
        }

        const items = [
            ...(parsed.trades || []),
            ...(parsed.deposits || []),
            ...(parsed.payouts || []),
            ...(parsed.payments || [])
        ];

        state.ingestedItems = state.ingestedItems.concat(items);
        recalculateAndRenderLedger();
    }

    function loadAllSyntheticSamples() {
        if (!window.SampleDataProvider) return;
        const samples = window.SampleDataProvider.SAMPLES;
        Object.keys(samples).forEach(k => {
            processFile(samples[k].name, samples[k].content);
        });
    }

    // ---------------------------------------------------------
    // 4. Jurisdiction Selector & Multi-Country Gating
    // ---------------------------------------------------------

    const countryCheckboxes = document.querySelectorAll('input[name="ws-country"]');
    countryCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const activePass = window.TradeLedgerAuth.getActivePass();
            const allowsMulti = activePass ? window.TradeLedgerConfig.plans[activePass.planId]?.multiCountryAllowed : false;

            const selected = Array.from(document.querySelectorAll('input[name="ws-country"]:checked'));
            
            // Single country enforcement for Free Trial & Weekly Pass
            if (!allowsMulti && selected.length > 1) {
                alert('Single-country tax tagging is active on Free Trial & Weekly Pass ($4.99). Upgrade to Monthly Pass ($9.99) for multi-country tagging.');
                cb.checked = false;
                return;
            }

            state.selectedCountries = Array.from(document.querySelectorAll('input[name="ws-country"]:checked')).map(c => c.value);
            recalculateAndRenderLedger();
        });
    });

    function recalculateAndRenderLedger() {
        if (!window.ReconciliationEngine) return;
        state.consolidatedResult = window.ReconciliationEngine.consolidateLedger(state.ingestedItems, state.selectedCountries);
        state.consolidatedResult.attestationConfirmed = state.attestationConfirmed;
        state.consolidatedResult.attestationText = state.attestationConfirmed
            ? 'User confirmed this data is accurate to the best of their knowledge before export.'
            : 'User attestation is required before export.';
        renderCountryEstimates();
        renderLedgerTable();
        renderExportState();
    }

    function renderIngestionErrors() {
        if (!ingestionErrorsBox) return;
        if (state.ingestionErrors.length === 0) {
            ingestionErrorsBox.classList.add('hidden');
            ingestionErrorsBox.innerHTML = '';
            return;
        }

        ingestionErrorsBox.classList.remove('hidden');
        ingestionErrorsBox.innerHTML = state.ingestionErrors
            .slice(-5)
            .map(error => `<div>${error}</div>`)
            .join('');
    }

    function renderCountryEstimates() {
        if (!wsCountryEstimates || !state.consolidatedResult) return;
        const ests = state.consolidatedResult.countryLiabilityEstimates;

        if (state.ingestedItems.length === 0) {
            wsCountryEstimates.innerHTML = '';
            return;
        }

        if (ests.length === 0) {
            wsCountryEstimates.innerHTML = '<div class="ingestion-errors" style="margin-top:0;">Select a jurisdiction country above to view tax estimates.</div>';
            return;
        }

        let cardsHtml = '';
        ests.forEach(cle => {
            cardsHtml += `
                <div style="flex:1; min-width:220px; background:var(--paper-bg); border:1px solid var(--paper-border); padding:16px; border-radius:6px;">
                    <div style="font-family:var(--font-mono); font-size:0.75rem; font-weight:700; color:var(--ink-muted);">${cle.countryName} JURISDICTION</div>
                    <div style="font-family:var(--font-serif); font-size:1.25rem; font-weight:700; color:var(--ink-black);">${cle.estimatedRange}</div>
                    <div style="font-size:0.75rem; color:var(--ink-slate); margin-top:4px;">${cle.disclaimer}</div>
                </div>
            `;
        });

        wsCountryEstimates.innerHTML = `<div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:12px;">${cardsHtml}</div>`;
    }

    function renderLedgerTable() {
        if (!wsTbodyLedger || !state.consolidatedResult) return;
        const items = state.consolidatedResult.categorizedItems;
        if (wsLineCount) wsLineCount.innerText = items.length;

        if (items.length === 0) {
            wsTbodyLedger.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:32px; color:var(--ink-muted);">No statement lines ingested yet. Click "Load Built-in Demo Samples" above.</td></tr>`;
            return;
        }

        wsTbodyLedger.innerHTML = '';
        items.forEach((item, index) => {
            const tr = document.createElement('tr');
            const pnlClass = (item.amount || 0) >= 0 ? 'ledger-amount text-pos' : 'ledger-amount text-neg';
            const tagBadge = (item.instrumentType === 'prop-payout') ? 'tag-prop' : ((item.instrumentType === 'futures') ? 'tag-futures' : 'tag-broker');
            const tagsHtml = (item.jurisdictionTags || []).map(t => `<span class="source-tag" style="margin-bottom:2px; font-size:10px;">${t.countryKey}: ${t.taxHead}</span>`).join('<br>');

            tr.innerHTML = `
                <td><input class="ledger-edit val-mono" data-index="${index}" data-field="id" value="${escapeAttr(item.id || '')}"></td>
                <td><input class="ledger-edit val-mono" data-index="${index}" data-field="date" value="${escapeAttr(item.date || '')}"></td>
                <td><input class="ledger-edit" data-index="${index}" data-field="source" value="${escapeAttr(item.source || '')}"></td>
                <td>
                    <select class="ledger-edit ledger-select source-tag ${tagBadge}" data-index="${index}" data-field="instrumentType">
                        ${['forex', 'futures', 'prop-payout', 'crypto', 'transfer'].map(type => `<option value="${type}" ${item.instrumentType === type ? 'selected' : ''}>${type}</option>`).join('')}
                    </select>
                </td>
                <td><input class="ledger-edit" data-index="${index}" data-field="description" value="${escapeAttr(item.symbol || item.description || 'P&L Operation')}"></td>
                <td><input class="ledger-edit ${pnlClass}" data-index="${index}" data-field="amount" type="number" step="0.01" value="${Number(item.amount || 0).toFixed(2)}"></td>
                <td><span class="confidence-badge ${item.confidence >= 90 ? 'confidence-high' : 'confidence-medium'}">${item.confidence || 100}%</span></td>
                <td>${tagsHtml}</td>
            `;
            wsTbodyLedger.appendChild(tr);
        });
    }

    function escapeAttr(value) {
        return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    if (wsTbodyLedger) {
        wsTbodyLedger.addEventListener('change', (event) => {
            const field = event.target.getAttribute('data-field');
            const index = Number(event.target.getAttribute('data-index'));
            if (!field || Number.isNaN(index) || !state.ingestedItems[index]) return;

            const value = field === 'amount' ? parseFloat(event.target.value || '0') : event.target.value;
            const nextItem = { ...state.ingestedItems[index], [field]: value };
            if (field === 'description') delete nextItem.symbol;
            nextItem.confidence = Math.min(nextItem.confidence || 100, 95);
            state.ingestedItems[index] = nextItem;
            recalculateAndRenderLedger();
        });
    }

    if (manualEntryForm) {
        const dateInput = document.getElementById('manual-date');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

        manualEntryForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const idInput = document.getElementById('manual-id');
            const newItem = {
                id: (idInput.value || `MANUAL-${Date.now()}`).trim(),
                date: document.getElementById('manual-date').value,
                source: document.getElementById('manual-source').value.trim(),
                instrumentType: document.getElementById('manual-type').value,
                description: document.getElementById('manual-description').value.trim(),
                amount: parseFloat(document.getElementById('manual-amount').value || '0'),
                confidence: 100
            };

            state.ingestedItems.push(newItem);
            manualEntryForm.reset();
            if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
            recalculateAndRenderLedger();
        });
    }

    if (attestationCheckbox) {
        attestationCheckbox.addEventListener('change', () => {
            state.attestationConfirmed = attestationCheckbox.checked;
            recalculateAndRenderLedger();
        });
    }

    // ---------------------------------------------------------
    // 5. Export Gating & Execution
    // ---------------------------------------------------------

    function renderExportState() {
        const hasRows = state.consolidatedResult && state.consolidatedResult.categorizedItems.length > 0;
        const canExportBasic = Boolean(hasRows && state.selectedCountries.length > 0 && state.attestationConfirmed);

        const activePass = window.TradeLedgerAuth.getActivePass();
        const plan = activePass ? window.TradeLedgerConfig.plans[activePass.planId] : null;

        if (btnExportCSV) btnExportCSV.disabled = !canExportBasic;
        if (btnExportPDF) btnExportPDF.disabled = !canExportBasic;

        if (btnExportExcel) {
            const excelAllowed = plan ? plan.exportsAllowed.includes('Excel') : false;
            btnExportExcel.disabled = !canExportBasic || !excelAllowed;
            btnExportExcel.title = excelAllowed ? '' : 'Excel export requires a Monthly Pass ($9.99).';
        }
    }

    function guardedExport(exportFn, formatName) {
        const check = window.TradeLedgerAuth.canGenerateReport(state.selectedCountries.length, formatName);

        if (!check.allowed) {
            alert(check.reason);
            openCryptoModal();
            return;
        }

        if (!state.consolidatedResult || state.consolidatedResult.categorizedItems.length === 0) {
            alert('No items in ledger to export.');
            return;
        }
        if (!state.attestationConfirmed) {
            alert('Please confirm the ledger attestation before exporting.');
            return;
        }
        if (state.selectedCountries.length === 0) {
            alert('Select a country tax jurisdiction before exporting.');
            return;
        }

        exportFn(state.consolidatedResult);
        window.TradeLedgerAuth.recordReportExport();
        updatePassStatusUI();
    }

    if (btnExportCSV) {
        btnExportCSV.addEventListener('click', () => guardedExport(window.ReconcilrExporter.exportCSV, 'CSV'));
    }

    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', () => guardedExport(window.ReconcilrExporter.exportExcel, 'Excel'));
    }

    if (btnExportPDF) {
        btnExportPDF.addEventListener('click', () => guardedExport(window.ReconcilrExporter.printAccountantPDF, 'PDF'));
    }

    // ---------------------------------------------------------
    // 6. Manual Crypto Pass Payment Modal
    // ---------------------------------------------------------

    const cryptoModal = document.getElementById('crypto-modal');
    const btnCloseCryptoModal = document.getElementById('btn-close-crypto-modal');
    const cryptoPlanRadios = document.querySelectorAll('input[name="crypto-plan"]');
    const cryptoAssetSelect = document.getElementById('crypto-asset-select');
    const cryptoDueAmount = document.getElementById('crypto-due-amount');
    const cryptoWalletAddress = document.getElementById('crypto-wallet-address');
    const btnCopyAddress = document.getElementById('btn-copy-address');
    const btnConfirmCryptoPay = document.getElementById('btn-confirm-crypto-pay');

    function openCryptoModal() {
        if (cryptoModal) cryptoModal.classList.remove('hidden');
        updateCryptoModalState();
    }

    function closeCryptoModal() {
        if (cryptoModal) cryptoModal.classList.add('hidden');
    }

    if (btnCloseCryptoModal) btnCloseCryptoModal.addEventListener('click', closeCryptoModal);

    function updateCryptoModalState() {
        const selectedPlanKey = document.querySelector('input[name="crypto-plan"]:checked')?.value || 'weekly';
        const plan = window.TradeLedgerConfig.plans[selectedPlanKey];
        if (cryptoDueAmount && plan) {
            cryptoDueAmount.textContent = `$${plan.priceUsd} USD`;
        }

        const selectedAssetSymbol = cryptoAssetSelect?.value || 'USDT';
        const assetConfig = window.TradeLedgerConfig.cryptoPayment.acceptedCryptos.find(a => a.symbol === selectedAssetSymbol);
        if (cryptoWalletAddress && assetConfig) {
            cryptoWalletAddress.textContent = assetConfig.address;
        }
    }

    cryptoPlanRadios.forEach(radio => radio.addEventListener('change', updateCryptoModalState));
    if (cryptoAssetSelect) cryptoAssetSelect.addEventListener('change', updateCryptoModalState);

    if (btnCopyAddress && cryptoWalletAddress) {
        btnCopyAddress.addEventListener('click', () => {
            navigator.clipboard.writeText(cryptoWalletAddress.textContent);
            btnCopyAddress.textContent = 'Copied!';
            setTimeout(() => { btnCopyAddress.textContent = 'Copy'; }, 1500);
        });
    }

    if (btnConfirmCryptoPay) {
        btnConfirmCryptoPay.addEventListener('click', () => {
            const selectedPlanKey = document.querySelector('input[name="crypto-plan"]:checked')?.value || 'weekly';
            const activated = window.TradeLedgerAuth.activatePass(selectedPlanKey, `CRYPTO-MANUAL-${Date.now()}`);
            if (activated) {
                alert(`Success! Your ${activated.planName} is now active for ${window.TradeLedgerConfig.plans[selectedPlanKey].durationDays} days.`);
                closeCryptoModal();
                updatePassStatusUI();
                recalculateAndRenderLedger();
            }
        });
    }

    // Auto-load built-in sample data into the workspace
    loadAllSyntheticSamples();

    if (window.lucide) lucide.createIcons();
});
