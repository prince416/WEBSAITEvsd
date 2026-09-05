/**
 * Trade Ledger Application Configuration & Constants
 */
window.TradeLedgerConfig = {
    // Supabase Authentication Configuration
    supabaseUrl: 'https://janfxxhneolrnzixviuz.supabase.co',
    // Supabase publishable keys are safe to expose in browser clients when RLS is enabled.
    supabasePublishableKey: window.__TRADE_LEDGER_SUPABASE_KEY__ || 'sb_publishable_bC_G6IpZpZEAj2xLLP38ww_VoKJNhpK',
    googleAuthEnabled: false,

    // Lead Capture Endpoint (Formspree or Supabase table)
    formspreeEndpoint: 'https://formspree.io/f/xqpklojk',

    // Usage-Based Free Trial Rules
    freeTrial: {
        maxFreeReports: 1,
        allowedExports: ['CSV', 'PDF'],
        multiCountryAllowed: false
    },

    // Pass-Based Subscription Plans (Manual Pay-Per-Period, NOT auto-renewing)
    plans: {
        weekly: {
            id: 'weekly',
            name: 'Weekly Pass',
            priceUsd: 4.99,
            durationDays: 7,
            multiCountryAllowed: false, // Single country tax tagging per report
            exportsAllowed: ['CSV', 'PDF'], // CSV + PDF only
            sourcesAllowed: ['broker', 'prop', 'payment', 'crypto'],
            ledgerPersistence: false,
            badge: 'ESSENTIAL'
        },
        monthly: {
            id: 'monthly',
            name: 'Monthly Pass',
            priceUsd: 9.99,
            durationDays: 30,
            multiCountryAllowed: true, // Multi-country tax tagging (select multiple at once)
            exportsAllowed: ['CSV', 'Excel', 'PDF'], // CSV + Excel + PDF
            sourcesAllowed: ['broker', 'prop', 'payment', 'crypto'],
            ledgerPersistence: true,
            badge: 'POPULAR'
        }
    },

    // Manual Crypto Payment Providers Configuration (NOWPayments / CoinGate / Plisio drop-in)
    cryptoPayment: {
        acceptedCryptos: [
            { symbol: 'USDT', name: 'Tether (TRC20 / ERC20)', address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' },
            { symbol: 'BTC', name: 'Bitcoin', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
            { symbol: 'ETH', name: 'Ethereum', address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' },
            { symbol: 'SOL', name: 'Solana', address: '7Vz3pX8K7qYw4vB3n9M2x5L8k1J6P0Q3R5S8T1U4V9W2' }
        ]
    }
};
