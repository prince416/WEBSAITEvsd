/**
 * MT4 / MT5 Statement Parser Module
 * Deterministically parses HTML & CSV reports from MetaTrader 4 and MetaTrader 5.
 */

window.MTParser = (function () {

    /**
     * Determine tax category based on symbol and trade type
     */
    function classifyTaxCategory(symbol, type) {
        if (!symbol || type === 'deposit' || type === 'withdrawal') {
            return 'Capital / Transfer';
        }
        
        const cleanSymbol = symbol.toUpperCase().trim();
        
        // Futures & Index Derivatives -> F&O / Business Income
        if (cleanSymbol.includes('US30') || cleanSymbol.includes('NAS100') || 
            cleanSymbol.includes('SPX') || cleanSymbol.includes('GER30') || 
            cleanSymbol.includes('DE40') || cleanSymbol.includes('BTC') || 
            cleanSymbol.includes('ETH') || cleanSymbol.endsWith('FUT') ||
            cleanSymbol.includes('FUTURES')) {
            return 'F&O / Derivatives';
        }

        // Default Forex & Spot Commodities (XAUUSD, EURUSD, etc.) -> Speculative Income
        return 'Speculative';
    }

    /**
     * Parse MT4 HTML Statement
     */
    function parseMT4HTML(htmlString, fileName) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const rows = Array.from(doc.querySelectorAll('table tr'));

        let accountNumber = 'MT4-Account';
        let broker = 'MetaTrader 4 Broker';
        const trades = [];
        const deposits = [];

        // Extract metadata header if present
        const titleRow = doc.querySelector('tr b');
        if (titleRow && titleRow.innerText) {
            const text = titleRow.innerText;
            const accMatch = text.match(/Account:\s*(\d+)/i);
            if (accMatch) accountNumber = accMatch[1];
        }

        let isClosedTradesSection = false;

        for (let i = 0; i < rows.length; i++) {
            const cells = Array.from(rows[i].querySelectorAll('td')).map(c => c.innerText.trim());

            if (cells.some(c => c.includes('Closed Transactions:'))) {
                isClosedTradesSection = true;
                continue;
            }

            if (cells.some(c => c.includes('Open Trades:') || c.includes('Working Orders:'))) {
                isClosedTradesSection = false;
            }

            // Standard MT4 Closed Trade Row format:
            // [Ticket, Open Time, Type, Size, Item/Symbol, Price, S/L, T/P, Close Time, Price, Commission, Taxes, Swap, Profit]
            if (isClosedTradesSection && cells.length >= 14) {
                const ticket = cells[0];
                const openTime = cells[1];
                const type = cells[2] ? cells[2].toLowerCase() : '';
                const size = parseFloat(cells[3]) || 0;
                const symbol = cells[4];
                const openPrice = parseFloat(cells[5]) || 0;
                const closeTime = cells[8];
                const closePrice = parseFloat(cells[9]) || 0;
                const commission = parseFloat(cells[10]) || 0;
                const taxes = parseFloat(cells[11]) || 0;
                const swap = parseFloat(cells[12]) || 0;
                const profit = parseFloat(cells[13]) || 0;

                // Check if deposit/withdrawal
                if (type.includes('deposit') || type.includes('withdrawal') || symbol === 'credit') {
                    deposits.push({
                        ticket,
                        date: openTime,
                        type: type.includes('deposit') ? 'Deposit' : 'Withdrawal',
                        amount: profit,
                        accountNumber,
                        broker
                    });
                    continue;
                }

                // Closed buy/sell trade
                if ((type.includes('buy') || type.includes('sell')) && ticket && !isNaN(profit)) {
                    const totalSwapComm = commission + taxes + swap;
                    const netPnL = profit + totalSwapComm;

                    trades.push({
                        ticket,
                        accountNumber,
                        broker,
                        sourceFile: fileName,
                        openTime,
                        closeTime: closeTime || openTime,
                        type: type.toUpperCase(),
                        symbol,
                        size,
                        openPrice,
                        closePrice,
                        commission,
                        swap: swap + taxes,
                        grossProfit: profit,
                        netPnL: parseFloat(netPnL.toFixed(2)),
                        taxCategory: classifyTaxCategory(symbol, type)
                    });
                }
            }
        }

        return {
            accountNumber,
            broker,
            trades,
            deposits,
            sourceFile: fileName,
            platform: 'MT4'
        };
    }

    /**
     * Parse MT5 CSV Statement
     */
    function parseMT5CSV(csvString, fileName) {
        const lines = csvString.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        let accountNumber = 'MT5-Account';
        let broker = 'MetaTrader 5 Broker';
        const trades = [];
        const deposits = [];

        let headers = [];
        let isDeals = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.split(/[,;\t]/).map(p => p.replace(/^"|"$/g, '').trim());

            if (line.toLowerCase().includes('account:')) {
                const accMatch = line.match(/account:\s*(\d+)/i);
                if (accMatch) accountNumber = accMatch[1];
            }

            if (parts.includes('Deal') || parts.includes('Position') || parts.includes('Ticket')) {
                headers = parts.map(h => h.toLowerCase());
                isDeals = true;
                continue;
            }

            if (isDeals && parts.length >= 8) {
                // Try header mapping or index fallback
                const ticket = parts[0];
                const date = parts[1] || parts[2];
                const type = (parts[2] || parts[3] || '').toLowerCase();
                const symbol = parts[4] || parts[3];
                const size = parseFloat(parts[5]) || 0;
                const price = parseFloat(parts[6]) || 0;
                const commission = parseFloat(parts[7]) || 0;
                const swap = parseFloat(parts[8]) || 0;
                const profit = parseFloat(parts[parts.length - 1]) || 0;

                if (type.includes('balance') || type.includes('deposit') || type.includes('withdrawal')) {
                    deposits.push({
                        ticket,
                        date,
                        type: profit >= 0 ? 'Deposit' : 'Withdrawal',
                        amount: profit,
                        accountNumber,
                        broker
                    });
                    continue;
                }

                if ((type.includes('buy') || type.includes('sell')) && ticket && !isNaN(profit)) {
                    const netPnL = profit + commission + swap;
                    trades.push({
                        ticket,
                        accountNumber,
                        broker,
                        sourceFile: fileName,
                        openTime: date,
                        closeTime: date,
                        type: type.toUpperCase(),
                        symbol: symbol || 'FX',
                        size,
                        openPrice: price,
                        closePrice: price,
                        commission,
                        swap,
                        grossProfit: profit,
                        netPnL: parseFloat(netPnL.toFixed(2)),
                        taxCategory: classifyTaxCategory(symbol, type)
                    });
                }
            }
        }

        return {
            accountNumber,
            broker,
            trades,
            deposits,
            sourceFile: fileName,
            platform: 'MT5'
        };
    }

    return {
        parseMT4HTML,
        parseMT5CSV,
        classifyTaxCategory
    };
})();
