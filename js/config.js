window.TradeLedgerConfig = {
    supabaseUrl: 'https://janfxxhneolrnzixviuz.supabase.co',
    // Set by the hosting environment or a non-committed deployment config.
    supabasePublishableKey: window.__TRADE_LEDGER_SUPABASE_KEY__ || '',
    formspreeEndpoint: 'https://formspree.io/f/xqpklojk',
    plans: {
        weekly: { label: 'Weekly Pass', priceUsd: 4.99, durationDays: 7, exports: ['CSV', 'PDF'], countries: 1 },
        monthly: { label: 'Monthly Pass', priceUsd: 9.99, durationDays: 30, exports: ['CSV', 'Excel', 'PDF'], countries: 'multiple' }
    }
};
