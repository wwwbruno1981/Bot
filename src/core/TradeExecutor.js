// src/core/TradeExecutor.js
const Logger = require('../utils/Logger');
const { handleCriticalError } = require('../utils/ErrorHandler'); // Importa o ErrorHandler

class TradeExecutor {
    constructor(config, logger, binanceAPIService, stateManager) {
        this.config = config;
        this.logger = logger || new Logger(config);
        this.binanceAPIService = binanceAPIService; // Dependência: Serviço da API da Binance
        this.stateManager = stateManager;           // Dependência: Gerenciador de Estado

        this.symbol = this.config.strategy.symbol;
        this.pricePrecision = this.config.strategy.pricePrecision;
        this.quantityPrecision = this.config.strategy.quantityPrecision;

        this.orderInProgress = false; // Flag para evitar múltiplas ordens simultâneas
        this.symbolInfo = null; // Armazenará as regras da exchange para o símbolo (filtros de preço/quantidade)

        this.logger.info('TradeExecutor inicializado.');
    }

    /**
     * Define as informações do símbolo da exchange, que são cruciais para validação de ordens.
     * Deve ser chamado na inicialização do bot, após obter o exchangeInfo da Binance.
     * @param {object} symbolInfo - Objeto com as regras e filtros do símbolo da Binance.
     */
    setSymbolInfo(symbolInfo) {
        this.symbolInfo = symbolInfo;
        this.logger.debug(`TradeExecutor recebeu informações do símbolo ${symbolInfo.symbol}.`);
    }

    /**
     * Valida e ajusta a quantidade e o preço da ordem com base nas regras da Binance.
     * @param {string} type - 'PRICE_FILTER' ou 'LOT_SIZE' para especificar qual filtro aplicar.
     * @param {number} value - O valor a ser ajustado (preço ou quantidade).
     * @returns {number} O valor ajustado.
     */
    applyExchangeFilter(type, value) {
        if (!this.symbolInfo) {
            this.logger.warn(`symbolInfo não carregado no TradeExecutor. Validação de ordem pode ser imprecisa.`);
            return value; // Retorna o valor original se as infos não estiverem disponíveis
        }

        const filter = this.symbolInfo.filters.find(f => f.filterType === type);
        if (!filter) {
            this.logger.warn(`Filtro ${type} não encontrado para o símbolo ${this.symbol}.`);
            return value;
        }

        switch (type) {
            case 'PRICE_FILTER':
                const tickSize = parseFloat(filter.tickSize);
                return parseFloat((Math.floor(value / tickSize) * tickSize).toFixed(this.pricePrecision));
            case 'LOT_SIZE':
                const stepSize = parseFloat(filter.stepSize);
                return parseFloat((Math.floor(value / stepSize) * stepSize).toFixed(this.quantityPrecision));
            case 'MIN_NOTIONAL':
                // MIN_NOTIONAL é um filtro que garante que o valor (preço * quantidade) seja maior que um mínimo.
                // Geralmente é verificado antes de enviar a ordem, mas podemos retornar o valor original aqui
                // já que não se trata de ajustar o preço ou quantidade diretamente.
                // A validação final de notional deve ocorrer antes de criar a ordem.
                return value;
            default:
                return value;
        }
    }

    /**
     * Executa uma ordem de compra no mercado.
     * @param {string} symbol - O par de negociação (ex: 'BTCUSDT').
     * @param {number} investmentAmountUsdt - A quantidade de USDT a ser investida.
     * @param {number} currentPrice - O preço atual do ativo.
     * @param {object} symbolInfo - As informações do símbolo da exchange para validação.
     * @param {number} availableQuoteBalance - Saldo disponível na moeda de cotação (ex: USDT).
     * @returns {object|null} O resultado da ordem executada ou null em caso de falha/rejeição.
     */
    async executeBuyOrder(symbol, investmentAmountUsdt, currentPrice, symbolInfo, availableQuoteBalance) {
        if (this.orderInProgress) {
            this.logger.warn('Ordem de compra já em progresso. Ignorando nova tentativa.');
            return null;
        }
        this.orderInProgress = true;

        this.setSymbolInfo(symbolInfo); // Garante que as infos do símbolo estejam atualizadas

        try {
            // 1. Calcular a quantidade base (ex: BTC) a ser comprada
            let quantity = investmentAmountUsdt / currentPrice;

            // 2. Aplicar filtros da exchange para a quantidade (LOT_SIZE)
            quantity = this.applyExchangeFilter('LOT_SIZE', quantity);

            // 3. Verificar o filtro MIN_NOTIONAL
            const minNotionalFilter = this.symbolInfo.filters.find(f => f.filterType === 'MIN_NOTIONAL');
            if (minNotionalFilter && (quantity * currentPrice) < parseFloat(minNotionalFilter.minNotional)) {
                this.logger.warn(`Quantidade calculada (${quantity.toFixed(this.quantityPrecision)}) para ${symbol} resultaria em um valor abaixo do MIN_NOTIONAL. Ordem cancelada.`);
                this.orderInProgress = false;
                return null;
            }

            // 4. Verificar se há saldo suficiente
            if (investmentAmountUsdt > availableQuoteBalance) {
                this.logger.warn(`Saldo insuficiente para compra. Necessário ${investmentAmountUsdt.toFixed(2)} USDT, disponível ${availableQuoteBalance.toFixed(2)} USDT.`);
                this.orderInProgress = false;
                return null;
            }

            this.logger.info(`Preparando ordem de COMPRA: ${quantity.toFixed(this.quantityPrecision)} ${symbol.replace('USDT', '')} @ ~${currentPrice.toFixed(this.pricePrecision)}`);

            // Usar MARKET order para compra simples, ou LIMIT se quiser um preço específico
            const order = await this.binanceAPIService.createOrder(
                symbol,
                'BUY',
                'MARKET', // ou 'LIMIT' se preferir um preço exato
                quantity,
                null // Para ordem de MARKET, price é null
            );

            // Se for MARKET order, a resposta incluirá a quantidade e o preço executado
            const executedQty = parseFloat(order.executedQty);
            const totalQuoteAmount = parseFloat(order.cummulativeQuoteQty);
            const avgPrice = totalQuoteAmount / executedQty;

            this.logger.trade(`Ordem de COMPRA EXECUTADA para ${symbol}:`, {
                orderId: order.orderId,
                status: order.status,
                executedQty,
                avgPrice: avgPrice.toFixed(this.pricePrecision),
                quoteAmount: totalQuoteAmount.toFixed(this.pricePrecision),
                side: 'BUY'
            });

            // Persistir o trade via StateManager
            await this.stateManager.saveTrade({
                symbol: symbol,
                orderId: order.orderId,
                side: 'BUY',
                type: 'MARKET',
                quantity: executedQty,
                price: avgPrice,
                timestamp: Date.now(),
                profit: 0 // Lucro inicial 0 para compras
            });

            return { executedQty, avgPrice };

        } catch (error) {
            this.logger.error(`Falha ao executar ordem de COMPRA para ${symbol}: ${error.message}`, {
                binanceErrorCode: error.response?.data?.code,
                binanceErrorMessage: error.response?.data?.msg
            });
            // O ErrorHandler global já foi configurado para erros críticos,
            // mas aqui podemos apenas logar e retornar null para que o bot continue (se não for crítico).
            this.orderInProgress = false;
            return null;
        } finally {
            this.orderInProgress = false; // Libera a flag após a tentativa de ordem
        }
    }

    /**
     * Executa uma ordem de venda no mercado.
     * @param {object} position - O estado atual da posição (amount, asset).
     * @param {number} currentPrice - O preço atual do ativo.
     * @param {object} symbolInfo - As informações do símbolo da exchange para validação.
     * @param {number} availableBaseBalance - Saldo disponível na moeda base (ex: BTC).
     * @param {string} reason - O motivo da venda (STOP_LOSS, TAKE_PROFIT, TRAILING_STOP).
     * @returns {object|null} O resultado da ordem executada ou null em caso de falha/rejeição.
     */
    async executeSellOrder(position, currentPrice, symbolInfo, availableBaseBalance, reason) {
        if (this.orderInProgress) {
            this.logger.warn('Ordem de venda já em progresso. Ignorando nova tentativa.');
            return null;
        }
        this.orderInProgress = true;

        this.setSymbolInfo(symbolInfo); // Garante que as infos do símbolo estejam atualizadas

        try {
            let quantityToSell = position.amount;

            // 1. Aplicar filtros da exchange para a quantidade (LOT_SIZE)
            quantityToSell = this.applyExchangeFilter('LOT_SIZE', quantityToSell);

            // 2. Verificar o filtro MIN_NOTIONAL para a venda
            const minNotionalFilter = this.symbolInfo.filters.find(f => f.filterType === 'MIN_NOTIONAL');
            if (minNotionalFilter && (quantityToSell * currentPrice) < parseFloat(minNotionalFilter.minNotional)) {
                this.logger.warn(`Quantidade calculada para venda (${quantityToSell.toFixed(this.quantityPrecision)}) para ${this.symbol} resultaria em um valor abaixo do MIN_NOTIONAL. Ajustando para o mínimo ou cancelando.`);
                // Opção: Tentar ajustar a quantidade para o mínimo, ou simplesmente cancelar a ordem.
                // Por segurança, vamos logar e retornar null por enquanto.
                this.orderInProgress = false;
                return null;
            }

            // 3. Verificar saldo disponível
            if (quantityToSell > availableBaseBalance) {
                this.logger.warn(`Saldo insuficiente para venda. Necessário ${quantityToSell.toFixed(this.quantityPrecision)} ${position.asset}, disponível ${availableBaseBalance.toFixed(this.quantityPrecision)} ${position.asset}.`);
                // Ajuste a quantidade para o máximo disponível se for o caso
                quantityToSell = this.applyExchangeFilter('LOT_SIZE', availableBaseBalance);
                this.logger.warn(`Ajustando quantidade de venda para o máximo disponível: ${quantityToSell.toFixed(this.quantityPrecision)} ${position.asset}.`);
                if (quantityToSell === 0) {
                    this.logger.error(`Quantidade ajustada para zero. Impossível vender.`);
                    this.orderInProgress = false;
                    return null;
                }
            }
            
            this.logger.info(`Preparando ordem de VENDA: ${quantityToSell.toFixed(this.quantityPrecision)} ${position.asset} @ ~${currentPrice.toFixed(this.pricePrecision)} (${reason})`);

            const order = await this.binanceAPIService.createOrder(
                this.symbol,
                'SELL',
                'MARKET', // Geralmente vendas de SL/TP são a mercado
                quantityToSell,
                null
            );

            const executedQty = parseFloat(order.executedQty);
            const totalQuoteAmount = parseFloat(order.cummulativeQuoteQty); // Valor total em USDT da venda
            const avgPrice = totalQuoteAmount / executedQty;

            // Calcular lucro/prejuízo
            const profitLoss = (avgPrice - this.stateManager.position.entryPrice) * executedQty; // Usa entryPrice do StateManager para cálculo

            this.logger.trade(`Ordem de VENDA EXECUTADA para ${this.symbol}:`, {
                orderId: order.orderId,
                status: order.status,
                executedQty,
                avgPrice: avgPrice.toFixed(this.pricePrecision),
                quoteAmount: totalQuoteAmount.toFixed(this.pricePrecision),
                side: 'SELL',
                reason: reason,
                profitLoss: profitLoss.toFixed(this.config.strategy.pricePrecision)
            });

            // Persistir o trade via StateManager, incluindo o lucro/prejuízo
            await this.stateManager.saveTrade({
                symbol: this.symbol,
                orderId: order.orderId,
                side: 'SELL',
                type: 'MARKET',
                quantity: executedQty,
                price: avgPrice,
                timestamp: Date.now(),
                profit: profitLoss,
                reason: reason
            });

            // Atualizar estatísticas diárias no StateManager
            this.stateManager.updateDailyStats({ profit: profitLoss, trades: 1 });


            return { executedQty, avgPrice, profitLoss };

        } catch (error) {
            this.logger.error(`Falha ao executar ordem de VENDA para ${this.symbol} (${reason}): ${error.message}`, {
                binanceErrorCode: error.response?.data?.code,
                binanceErrorMessage: error.response?.data?.msg
            });
            this.orderInProgress = false;
            return null;
        } finally {
            this.orderInProgress = false; // Libera a flag após a tentativa de ordem
        }
    }
}

module.exports = TradeExecutor;