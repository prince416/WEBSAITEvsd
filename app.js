/**
 * Reconcilr Full Application & Interactive Workspace Controller
 */

document.addEventListener('DOMContentLoaded', () => {

    // Application State
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

    // ---------------------------------------------------------
    // 1. Hero Resolution Animation Sequence
    // ---------------------------------------------------------

    const scannerBeam = document.getElementById('scanner-beam');
    const scatteredContainer = document.getElementById('scattered-container');
    const resolvedContainer = document.getElementById('resolved-container');
    const rubberStamp = document.getElementById('rubber-stamp');
    const btnReplay = document.getElementById('btn-replay-animation');

    function triggerResolutionAnimation() {
        if (!scannerBeam || !scatteredContainer || !resolvedContainer || !rubberStamp) return;
        scannerBeam.classList.remove('active');
        scatteredContainer.classList.remove('resolving');
        scatteredContainer.classList.remove('hidden');
        resolvedContainer.classList.add('hidden');
        rubberStamp.classList.remove('stamped');

        setTimeout(() => {
            scannerBeam.classList.add('active');
            scatteredContainer.classList.add('resolving');
        }, 100);

        setTimeout(() => {
            scatteredContainer.classList.add('hidden');
            resolvedContainer.classList.remove('hidden');
        }, 1400);

        setTimeout(() => {
            rubberStamp.classList.add('stamped');
        }, 1800);
    }

    triggerResolutionAnimation();
    if (btnReplay) btnReplay.addEventListener('click', triggerResolutionAnimation);

    // ---------------------------------------------------------
    // 2. Interactive Workspace & File Ingestion
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
        const samples = window.SampleDataProvider.SAMPLES;
        Object.keys(samples).forEach(k => {
            processFile(samples[k].name, samples[k].content);
        });
    }

    // ---------------------------------------------------------
    // 3. Multi-Country Jurisdiction Selector & Calculation
    // ---------------------------------------------------------

    const countryCheckboxes = document.querySelectorAll('input[name="ws-country"]');
    countryCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const selected = Array.from(document.querySelectorAll('input[name="ws-country"]:checked')).map(c => c.value);
            state.selectedCountries = selected;
            recalculateAndRenderLedger();
        });
    });

    function recalculateAndRenderLedger() {
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
        if (!wsCountryEstimates) return;
        const ests = state.consolidatedResult.countryLiabilityEstimates;

        if (state.ingestedItems.length === 0) {
            wsCountryEstimates.innerHTML = '';
            return;
        }

        if (ests.length === 0) {
            wsCountryEstimates.innerHTML = '<div class="ingestion-errors" style="margin-top:0;">Select every country where you file to apply jurisdiction reference tags. No tax estimate is shown until then.</div>';
            return;
        }

        let cardsHtml = '';
        ests.forEach(cle => {
            cardsHtml += `
                <div style="flex:1; min-width:220px; background:var(--paper-bg); border:1px solid var(--paper-border); padding:16px;">
                    <div style="font-family:var(--font-mono); font-size:0.75rem; font-weight:700; color:var(--ink-muted);">${cle.countryName} JURISDICTION</div>
                    <div style="font-family:var(--font-serif); font-size:1.25rem; font-weight:700; color:var(--ink-black);">${cle.estimatedRange}</div>
                    <div style="font-size:0.75rem; color:var(--ink-slate); margin-top:4px;">${cle.disclaimer}</div>
                </div>
            `;
        });

        wsCountryEstimates.innerHTML = `
            <div style="display:flex; gap:12px; flex-wrap:wrap;">
                ${cardsHtml}
            </div>
        `;
    }

    function renderLedgerTable() {
        if (!wsTbodyLedger) return;
        const items = state.consolidatedResult.categorizedItems;
        wsLineCount.innerText = items.length;

        if (items.length === 0) {
            wsTbodyLedger.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:32px; color:var(--ink-muted);">No statements ingested yet. Click "Load Built-in Demo Samples" above.</td></tr>`;
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
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
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

    function renderExportState() {
        const hasRows = state.consolidatedResult && state.consolidatedResult.categorizedItems.length > 0;
        const canExport = Boolean(hasRows && state.selectedCountries.length > 0 && state.attestationConfirmed);
        [btnExportCSV, btnExportExcel, btnExportPDF].forEach(button => {
            if (!button) return;
            button.disabled = !canExport;
            button.title = canExport ? '' : 'Select filing countries, review the editable ledger, and check the attestation before export.';
        });
    }

    function guardedExport(exportFn) {
        if (!state.consolidatedResult || state.consolidatedResult.categorizedItems.length === 0) {
            alert('No items in ledger to export.');
            return;
        }
        if (!state.attestationConfirmed) {
            alert('Please confirm the ledger attestation before exporting.');
            return;
        }
        if (state.selectedCountries.length === 0) {
            alert('Select every country where you file before exporting.');
            return;
        }
        exportFn(state.consolidatedResult);
    }

    // ---------------------------------------------------------
    // 4. Exporters
    // ---------------------------------------------------------

    if (btnExportCSV) {
        btnExportCSV.addEventListener('click', () => {
            guardedExport(window.ReconcilrExporter.exportCSV);
        });
    }

    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', () => {
            guardedExport(window.ReconcilrExporter.exportExcel);
        });
    }

    if (btnExportPDF) {
        btnExportPDF.addEventListener('click', () => {
            guardedExport(window.ReconcilrExporter.printAccountantPDF);
        });
    }

    // ---------------------------------------------------------
    // 5. Country Preview Tabs & Forms
    // ---------------------------------------------------------

    const COUNTRY_DATA = {
        US: { title: 'United States — CPA Schedule C & Section 1256 Formats', flag: '🇺🇸', rules: [{ category: 'Futures Contracts', treatment: '60% LT / 40% ST Capital Gain', form: 'Form 6781' }, { category: 'Prop Payouts', treatment: 'Self-Employment Income', form: 'Schedule C' }] },
        IN: { title: 'India — CA ITR-3 & Section 44ADA Schedules', flag: '🇮🇳', rules: [{ category: 'Speculative Forex', treatment: 'Section 28(i) Speculative Business', form: 'ITR-3 Schedule BP' }, { category: 'Prop Payouts', treatment: 'Service / Contractor Pay (Sec 44ADA)', form: 'ITR-3 / ITR-4' }] },
        UK: { title: 'United Kingdom — HMRC Self Assessment', flag: '🇬🇧', rules: [{ category: 'CFD Trading', treatment: 'Trading Income / Capital Gains', form: 'SA103F' }] },
        AU: { title: 'Australia — ATO Tax Return & CGT', flag: '🇦🇺', rules: [{ category: 'Futures & Forex', treatment: 'ATO Ordinary Income', form: 'Item 15' }] },
        EU: { title: 'European Union — Standardized Output', flag: '🇪🇺', rules: [{ category: 'Derivatives P&L', treatment: 'Capital Gains Income', form: 'National Return' }] }
    };

    const countryBtns = document.querySelectorAll('.country-btn');
    const countryDetailsCard = document.getElementById('country-details-card');

    function renderCountryDetails(countryKey) {
        if (!countryDetailsCard) return;
        const data = COUNTRY_DATA[countryKey] || COUNTRY_DATA['US'];
        let rowsHtml = '';
        data.rules.forEach(rule => {
            rowsHtml += `<tr><td><strong>${rule.category}</strong></td><td class="text-pos">${rule.treatment}</td><td><span class="source-tag tag-broker">${rule.form}</span></td></tr>`;
        });
        countryDetailsCard.innerHTML = `
            <h3 style="font-family:var(--font-serif); font-size:1.3rem; margin-bottom:12px;">${data.flag} ${data.title}</h3>
            <div class="ledger-table-wrapper"><table class="hairline-table"><thead><tr><th>CLASS</th><th>TREATMENT</th><th>FORM MAP</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
        `;
    }

    countryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            countryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCountryDetails(btn.getAttribute('data-country'));
        });
    });

    renderCountryDetails('US');

    // Waitlist Form & Modal
    const heroQuickForm = document.getElementById('hero-quick-form');
    const fullWaitlistForm = document.getElementById('full-waitlist-form');
    const successModal = document.getElementById('success-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');

    function handleFormSubmit(e) {
        e.preventDefault();
        if (successModal) successModal.classList.remove('hidden');
    }

    if (heroQuickForm) heroQuickForm.addEventListener('submit', handleFormSubmit);
    if (fullWaitlistForm) fullWaitlistForm.addEventListener('submit', handleFormSubmit);
    if (btnCloseModal) btnCloseModal.addEventListener('click', () => successModal.classList.add('hidden'));

    // Boot synthetic samples on load
    loadAllSyntheticSamples();

});
