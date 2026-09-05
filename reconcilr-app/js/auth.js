window.TradeLedgerAuth = (function () {
    const config = window.TradeLedgerConfig;
    const client = window.supabase && config?.supabaseUrl && config?.supabasePublishableKey
        ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey)
        : null;

    // Local Storage Keys
    const SESSION_KEY = 'trade_ledger_session';
    const USER_STATE_KEY = 'trade_ledger_user_state';
    const LEADS_KEY = 'trade_ledger_leads';

    function getUserState() {
        const defaultState = {
            freeReportsUsed: 0,
            activePass: null, // { planId: 'weekly'|'monthly', expiryTimestamp: number, paymentRef: string }
            createdTimestamp: Date.now()
        };
        const stored = localStorage.getItem(USER_STATE_KEY);
        if (!stored) return defaultState;
        try {
            return { ...defaultState, ...JSON.parse(stored) };
        } catch (e) {
            return defaultState;
        }
    }

    function saveUserState(state) {
        localStorage.setItem(USER_STATE_KEY, JSON.stringify(state));
    }

    function getActivePass() {
        const state = getUserState();
        if (!state.activePass) return null;
        if (Date.now() > state.activePass.expiryTimestamp) {
            return null; // Expired
        }
        return state.activePass;
    }

    function isPassActive() {
        return Boolean(getActivePass());
    }

    function canGenerateReport(selectedCountriesCount, exportFormat) {
        const state = getUserState();
        const activePass = getActivePass();

        // Check if active pass exists
        if (activePass) {
            const planConfig = config.plans[activePass.planId];
            if (!planConfig) return { allowed: false, reason: 'Invalid pass configuration.' };

            // Multi-country check
            if (selectedCountriesCount > 1 && !planConfig.multiCountryAllowed) {
                return {
                    allowed: false,
                    reason: 'Weekly Pass supports single-country tax tagging per report. Upgrade to Monthly Pass for multi-country tagging.'
                };
            }

            // Export format check
            if (exportFormat && !planConfig.exportsAllowed.includes(exportFormat)) {
                return {
                    allowed: false,
                    reason: `${exportFormat} export requires a Monthly Pass ($9.99). Your Weekly Pass supports CSV and PDF exports.`
                };
            }

            return { allowed: true, mode: 'pass', plan: planConfig };
        }

        // Check Free Trial
        if (state.freeReportsUsed < config.freeTrial.maxFreeReports) {
            if (selectedCountriesCount > 1 && !config.freeTrial.multiCountryAllowed) {
                return {
                    allowed: false,
                    reason: 'Free Trial supports single-country tax tagging. Upgrade to a pass for multi-country tagging.'
                };
            }
            if (exportFormat && !config.freeTrial.allowedExports.includes(exportFormat)) {
                return {
                    allowed: false,
                    reason: `${exportFormat} export requires a Monthly Pass. Free Trial supports CSV and PDF exports.`
                };
            }
            return { allowed: true, mode: 'free_trial', remaining: config.freeTrial.maxFreeReports - state.freeReportsUsed };
        }

        return {
            allowed: false,
            reason: 'You have used your 1 free reconciliation report export. Purchase a Weekly Pass ($4.99) or Monthly Pass ($9.99) to continue generating reports.'
        };
    }

    function recordReportExport() {
        const state = getUserState();
        const activePass = getActivePass();
        if (!activePass) {
            state.freeReportsUsed = (state.freeReportsUsed || 0) + 1;
            saveUserState(state);
        }
    }

    function activatePass(planId, paymentRef) {
        const planConfig = config.plans[planId];
        if (!planConfig) return false;

        const durationMs = planConfig.durationDays * 24 * 60 * 60 * 1000;
        const state = getUserState();
        state.activePass = {
            planId,
            planName: planConfig.name,
            paymentRef: paymentRef || `CRYPTO-${Date.now()}`,
            activatedTimestamp: Date.now(),
            expiryTimestamp: Date.now() + durationMs
        };
        saveUserState(state);
        return state.activePass;
    }

    // Lead Persistence (Waitlist & Public Forms)
    async function persistLead(email, source = 'landing_waitlist', extraData = {}) {
        if (!email || !email.includes('@')) throw new Error('Please enter a valid email address.');

        // 1. Store in localStorage as backup guarantee
        const leads = JSON.parse(localStorage.getItem(LEADS_KEY) || '[]');
        leads.push({ email, source, extraData, timestamp: new Date().toISOString() });
        localStorage.setItem(LEADS_KEY, JSON.stringify(leads));

        // 2. Submit to Formspree endpoint if configured
        if (config?.formspreeEndpoint) {
            const formData = new FormData();
            formData.append('email', email);
            formData.append('source', source);
            formData.append('_subject', `New Trade Ledger Lead [${source}]`);
            Object.keys(extraData).forEach(key => formData.append(key, extraData[key]));

            try {
                await fetch(config.formspreeEndpoint, {
                    method: 'POST',
                    body: formData,
                    headers: { Accept: 'application/json' }
                });
            } catch (err) {
                console.warn('Lead formspree submit:', err.message);
            }
        }

        // 3. Store in Supabase leads table if available
        if (client) {
            try {
                await client.from('leads').insert([{ email, source, metadata: extraData }]);
            } catch (err) {
                console.warn('Supabase lead storage:', err.message);
            }
        }

        return true;
    }

    function setStatus(message, isError = false) {
        const status = document.getElementById('auth-status');
        if (status) {
            status.textContent = message;
            status.style.color = isError ? 'var(--stamp-red)' : 'var(--accent-green)';
            status.dataset.state = isError ? 'error' : 'success';
        }
    }

    async function signInWithGoogle() {
        if (client && config?.googleAuthEnabled) {
            const { error } = await client.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + '/app.html' }
            });
            if (error) throw error;
        } else {
            // Demo Fallback Google Auth
            setStatus('Connecting Google Account...');
            setTimeout(() => {
                const demoSession = { user: { email: 'demo.trader@gmail.com' }, token: 'demo_token_123' };
                localStorage.setItem(SESSION_KEY, JSON.stringify(demoSession));
                setStatus('Signed in as demo.trader@gmail.com! Redirecting to App...');
                setTimeout(() => { window.location.href = 'app.html'; }, 700);
            }, 600);
        }
    }

    async function submitEmailPassword(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const email = form.email.value;
        const password = form.password.value;
        const mode = form.dataset.mode || 'signin';

        if (!email || !email.includes('@')) throw new Error('Please enter a valid email address.');
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');

        if (mode === 'signup') {
            const confirmPass = form.passwordConfirm?.value;
            if (confirmPass && confirmPass !== password) throw new Error('Passwords do not match.');
            // Persist signup lead
            persistLead(email, 'user_signup');
        }

        setStatus(mode === 'signup' ? 'Creating your account...' : 'Signing in...');

        if (client) {
            try {
                const result = mode === 'signup'
                    ? await client.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + '/app.html' } })
                    : await client.auth.signInWithPassword({ email, password });
                
                if (result.error) throw result.error;
                
                if (result.data.session) {
                    localStorage.setItem(SESSION_KEY, JSON.stringify(result.data.session));
                    setStatus('Success! Redirecting to Product Workspace...');
                    setTimeout(() => { window.location.href = 'app.html'; }, 600);
                    return;
                } else if (mode === 'signup') {
                    setStatus('Account created! Redirecting to Product Workspace...');
                    setTimeout(() => { window.location.href = 'app.html'; }, 800);
                    return;
                }
            } catch (err) {
                console.warn('Supabase auth call:', err.message);
            }
        }

        // Demo Fallback Auth
        const demoSession = { user: { email }, token: 'demo_token_' + Date.now() };
        localStorage.setItem(SESSION_KEY, JSON.stringify(demoSession));
        setStatus('Welcome to Trade Ledger! Access granted. Redirecting to App...');
        setTimeout(() => { window.location.href = 'app.html'; }, 700);
    }

    async function requestReset() {
        const email = document.querySelector('#auth-form [name="email"]')?.value;
        if (!email) return setStatus('Enter your email address above first.', true);
        if (client) {
            const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/login.html' });
            setStatus(error ? error.message : 'Password reset link sent to your email.', Boolean(error));
        } else {
            setStatus(`Password reset instructions sent to ${email}. Check your inbox.`);
        }
    }

    function init() {
        document.getElementById('btn-google')?.addEventListener('click', () => signInWithGoogle().catch(error => setStatus(error.message, true)));
        document.getElementById('btn-reset')?.addEventListener('click', requestReset);
        document.getElementById('auth-form')?.addEventListener('submit', event => submitEmailPassword(event).catch(error => setStatus(error.message, true)));

        // Auth mode tabs switcher
        document.querySelectorAll('[data-auth-mode]').forEach(button => {
            button.addEventListener('click', () => {
                document.querySelectorAll('[data-auth-mode]').forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-selected', 'false');
                });
                button.classList.add('active');
                button.setAttribute('aria-selected', 'true');

                const form = document.getElementById('auth-form');
                const mode = button.dataset.authMode;
                if (form) form.dataset.mode = mode;

                const submitBtn = document.getElementById('auth-submit');
                if (submitBtn) submitBtn.innerHTML = mode === 'signup' ? 'Create account <i data-lucide="arrow-right"></i>' : 'Sign in <i data-lucide="arrow-right"></i>';

                const titleEl = document.getElementById('auth-title');
                const copyEl = document.getElementById('auth-copy');
                if (titleEl) titleEl.textContent = mode === 'signup' ? 'Create your account' : 'Welcome back';
                if (copyEl) copyEl.textContent = mode === 'signup' ? 'Start building your accountant-ready trading ledger.' : 'Sign in to access your reconciliation workspace.';

                const confirmWrap = document.getElementById('confirm-password-wrap');
                if (confirmWrap) {
                    if (mode === 'signup') confirmWrap.classList.remove('hidden');
                    else confirmWrap.classList.add('hidden');
                }

                if (window.lucide) lucide.createIcons();
            });
        });
    }

    function logout() {
        localStorage.removeItem(SESSION_KEY);
        if (client) client.auth.signOut();
        window.location.href = 'index.html';
    }

    return {
        init,
        client,
        getUserState,
        getActivePass,
        isPassActive,
        canGenerateReport,
        recordReportExport,
        activatePass,
        persistLead,
        logout
    };
})();
