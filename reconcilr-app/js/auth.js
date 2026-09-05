window.TradeLedgerAuth = (function () {
    const config = window.TradeLedgerConfig;
    const client = window.supabase && config?.supabaseUrl && config?.supabasePublishableKey
        ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey)
        : null;

    function showProduct(session) {
        document.querySelectorAll('.product-area').forEach(el => el.classList.remove('hidden'));
        document.body.classList.add('is-authenticated');
        document.getElementById('auth-modal')?.classList.add('hidden');
        const authButton = document.getElementById('btn-auth');
        if (authButton) authButton.textContent = session ? 'OPEN PRODUCT' : 'SIGN IN';
    }

    async function signInWithGoogle() {
        const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
        if (error) throw error;
    }

    async function submitEmailPassword(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const email = form.email.value;
        const password = form.password.value;
        const mode = form.dataset.mode || 'signin';
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        const result = mode === 'signup'
            ? await client.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + window.location.pathname } })
            : await client.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        if (result.data.session) showProduct(result.data.session);
        else setStatus('Check your email to confirm your account, then sign in.');
    }

    function setStatus(message, isError = false) {
        const status = document.getElementById('auth-status');
        if (status) { status.textContent = message; status.dataset.state = isError ? 'error' : ''; }
    }

    async function requestReset() {
        const email = document.querySelector('#auth-form [name="email"]')?.value;
        if (!email) return setStatus('Enter your email first.', true);
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
        setStatus(error ? error.message : 'If that account exists, a password-reset email is on its way.', Boolean(error));
    }

    function init() {
        if (!client) return;
        document.getElementById('btn-auth')?.addEventListener('click', () => document.getElementById('auth-modal')?.classList.remove('hidden'));
        document.getElementById('btn-google')?.addEventListener('click', () => signInWithGoogle().catch(error => setStatus(error.message, true)));
        document.getElementById('btn-reset')?.addEventListener('click', requestReset);
        document.getElementById('auth-form')?.addEventListener('submit', event => submitEmailPassword(event).catch(error => setStatus(error.message, true)));
        document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => {
            const form = document.getElementById('auth-form');
            form.dataset.mode = button.dataset.authMode;
            document.getElementById('auth-submit').textContent = button.dataset.authMode === 'signup' ? 'Create account' : 'Sign in';
        }));
        client.auth.getSession().then(({ data }) => { if (data.session) showProduct(data.session); });
        client.auth.onAuthStateChange((_event, session) => { if (session) showProduct(session); });
    }

    return { init, client };
})();
