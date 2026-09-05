window.TradeLedgerConfig = {
    supabaseUrl: 'https://janfxxhneolrnzixviuz.supabase.co',
    // Supabase publishable keys are safe to expose in browser clients when RLS is enabled.
    supabasePublishableKey: window.__TRADE_LEDGER_SUPABASE_KEY__ || 'sb_publishable_bC_G6IpZpZEAj2xLLP38ww_VoKJNhpK',
    googleAuthEnabled: false,
    formspreeEndpoint: 'https://formspree.io/f/xqpklojk',
    plans: {
        weekly: { label: 'Weekly Pass', priceUsd: 4.99, durationDays: 7, exports: ['CSV', 'PDF'], countries: 1 },
        monthly: { label: 'Monthly Pass', priceUsd: 9.99, durationDays: 30, exports: ['CSV', 'Excel', 'PDF'], countries: 'multiple' }
    }
};
