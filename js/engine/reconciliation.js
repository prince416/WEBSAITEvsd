/**
 * Reconcilr Multi-Country Reconciliation & Tax Mapping Engine
 * Consolidates multi-source statements, tags jurisdiction tax heads, and calculates estimated liability ranges.
 */

window.ReconciliationEngine = (function () {

    const COUNTRY_RULES = {
        US: {
            name: 'United States',
            currency: 'USD',
            fxRateToUSD: 1.0,
            disclaimer: 'Estimates based on US IRS Schedule C & Section 1256 reference rules. Verify with a US CPA.',
            taxHeads: {
                forex: { head: 'Section 988 Foreign Exchange', rateMin: 0.15, rateMax: 0.24, form: 'Form 8949 / Schedule D' },
                futures: { head: 'Section 1256 (60% LT / 40% ST)', rateMin: 0.15, rateMax: 0.20, form: 'Form 6781' },
                'prop-payout': { head: 'Schedule C Contractor Income', rateMin: 0.153, rateMax: 0.30, form: 'Schedule C (Form 1040)' },
                crypto: { head: 'Crypto Capital Gains', rateMin: 0.15, rateMax: 0.24, form: 'Form 8949' }
            }
        },
        IN: {
            name: 'India',
            currency: 'INR',
            fxRateToUSD: 83.50,
            disclaimer: 'Estimates based on Indian Income Tax Act Sec 28(i) & Sec 44ADA reference rules. Verify with an Indian CA.',
            taxHeads: {
                forex: { head: 'Section 28(i) Speculative Income', rateMin: 0.20, rateMax: 0.30, form: 'ITR-3 Schedule BP' },
                futures: { head: 'Section 28(i) Non-Speculative F&O', rateMin: 0.15, rateMax: 0.30, form: 'ITR-3 Schedule BP' },
                'prop-payout': { head: 'Service Income / Sec 44ADA', rateMin: 0.10, rateMax: 0.15, form: 'ITR-3 / ITR-4' },
                crypto: { head: 'Section 115BBH (30% Flat Tax)', rateMin: 0.30, rateMax: 0.30, form: 'ITR-3 Schedule VDA' }
            }
        },
        UK: {
            name: 'United Kingdom',
            currency: 'GBP',
            fxRateToUSD: 0.79,
            disclaimer: 'Estimates based on HMRC Self Assessment reference rules. Verify with a UK Chartered Accountant.',
            taxHeads: {
                forex: { head: 'Capital Gains / Trading Income', rateMin: 0.10, rateMax: 0.20, form: 'SA100 / SA103' },
                futures: { head: 'Trading Derivatives Income', rateMin: 0.10, rateMax: 0.20, form: 'SA103F' },
                'prop-payout': { head: 'Self-Employed Sole Trader Pay', rateMin: 0.20, rateMax: 0.40, form: 'SA103F' },
                crypto: { head: 'HMRC Cryptoasset Capital Gains', rateMin: 0.10, rateMax: 0.20, form: 'SA108' }
            }
        },
        AU: {
            name: 'Australia',
            currency: 'AUD',
            fxRateToUSD: 1.52,
            disclaimer: 'Estimates based on ATO Ordinary Income & CGT reference rules. Verify with an Australian Tax Agent.',
            taxHeads: {
                forex: { head: 'ATO Ordinary Income (Trader)', rateMin: 0.19, rateMax: 0.32, form: 'Item 15 Trader Return' },
                futures: { head: 'Financial Derivatives P&L', rateMin: 0.19, rateMax: 0.32, form: 'Individual Return' },
                'prop-payout': { head: 'Personal Services Income (PSI)', rateMin: 0.19, rateMax: 0.37, form: 'Business Schedule' },
                crypto: { head: 'ATO Crypto CGT Event', rateMin: 0.19, rateMax: 0.37, form: 'CGT Schedule' }
            }
        },
        EU: {
            name: 'European Union / Global',
            currency: 'EUR',
            fxRateToUSD: 0.92,
            disclaimer: 'General reference labels only; country-specific income, capital-gains, VAT, and filing rules vary. Verify with a licensed accountant in the filing country.',
            taxHeads: {
                forex: { head: 'Trading / Capital Gains Reference', rateMin: 0.15, rateMax: 0.30, form: 'National Return' },
                futures: { head: 'Derivatives P&L Reference', rateMin: 0.15, rateMax: 0.30, form: 'National Return' },
                'prop-payout': { head: 'Self-Employment / Service Income Reference', rateMin: 0.15, rateMax: 0.35, form: 'National Return' },
                crypto: { head: 'Cryptoasset Income / Gains Reference', rateMin: 0.15, rateMax: 0.30, form: 'National Return' }
            }
        }
    };

    /**
     * Consolidate items and tag with multiple country tax rules
     */
    function consolidateLedger(items = [], selectedCountries = []) {
        if (!selectedCountries) selectedCountries = [];

        let totalGrossProfit = 0;
        let totalExpenses = 0;
        let totalNetUSD = 0;

        const categorizedItems = items.map(item => {
            const amount = item.amount || 0;
            if (amount > 0) totalGrossProfit += amount;
            else totalExpenses += Math.abs(amount);
            totalNetUSD += amount;

            // Generate Jurisdiction Tags for selected countries
            const jurisdictionTags = selectedCountries.map(countryKey => {
                const cData = COUNTRY_RULES[countryKey] || COUNTRY_RULES['US'];
                const instType = item.instrumentType || 'forex';
                const rule = (cData.taxHeads && cData.taxHeads[instType]) ? cData.taxHeads[instType] : { head: 'General Income', rateMin: 0.15, rateMax: 0.25, form: 'Tax Schedule' };

                const localAmount = amount * cData.fxRateToUSD;
                const estTaxMin = Math.max(0, localAmount * rule.rateMin);
                const estTaxMax = Math.max(0, localAmount * rule.rateMax);

                return {
                    countryKey,
                    country: countryKey,
                    countryName: cData.name,
                    currency: cData.currency,
                    taxHead: rule.head,
                    form: rule.form,
                    localAmount: parseFloat(localAmount.toFixed(2)),
                    estTaxRange: `${cData.currency} ${estTaxMin.toFixed(0)} – ${estTaxMax.toFixed(0)} estimate — verify with a licensed accountant`
                };
            });

            return {
                ...item,
                jurisdictionTags
            };
        });

        // Compute Consolidated Estimated Tax Liability Ranges per country
        const countryLiabilityEstimates = selectedCountries.map(countryKey => {
            const cData = COUNTRY_RULES[countryKey] || COUNTRY_RULES['US'];
            const localNet = totalNetUSD * cData.fxRateToUSD;

            // Rough aggregate bracket estimate (15% - 30%)
            const minEst = Math.max(0, localNet * 0.15);
            const maxEst = Math.max(0, localNet * 0.30);

            return {
                countryKey,
                countryName: cData.name,
                currency: cData.currency,
                localNet: parseFloat(localNet.toFixed(2)),
                estimatedRange: `${cData.currency} ${minEst.toLocaleString('en-US', { maximumFractionDigits: 0 })} – ${maxEst.toLocaleString('en-US', { maximumFractionDigits: 0 })} estimate — verify with a licensed accountant`,
                disclaimer: cData.disclaimer
            };
        });

        return {
            categorizedItems,
            metrics: {
                totalCount: items.length,
                totalGrossProfitUSD: parseFloat(totalGrossProfit.toFixed(2)),
                totalExpensesUSD: parseFloat(totalExpenses.toFixed(2)),
                totalNetUSD: parseFloat(totalNetUSD.toFixed(2))
            },
            countryLiabilityEstimates,
            selectedCountries
        };
    }

    return {
        consolidateLedger,
        COUNTRY_RULES
    };
})();
