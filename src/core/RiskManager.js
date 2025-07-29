// src/core/RiskManager.js
const Logger = require('../utils/Logger');

class RiskManager {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger || new Logger(config); // Usa logger passado ou cria um novo

        this.maxDailyLossPercentage = parseFloat(process.env.MAX_DAILY_LOSS_PERCENTAGE || '0.05'); // 5% de perda máxima diária
        this.maxDailyTrades = parseInt(process.env.MAX_DAILY_TRADES || '5', 10); // Máximo de 5 trades por dia
        this.logger.info(`RiskManager inicializado. Perda Diária Máx: ${this.maxDailyLossPercentage * 100}%, Trades Diários Máx: ${this.maxDailyTrades}`);
    }

    /**
     * Verifica se o bot pode realizar um novo trade com base nos limites de risco diários.
     * @param {object} dailyStats - Objeto com as estatísticas diárias do bot (trades, profit, startTime).
     * @param {number} investmentAmount - O valor que será investido em um trade.
     * @returns {{canTrade: boolean, reason: string}} Objeto indicando se pode tradar e o motivo.
     */
    checkDailyRiskLimits(dailyStats, investmentAmount) {
        // Obter o balanço inicial da sessão para calcular o capital de referência.
        // Isso é crucial para que a % de perda diária seja sobre o capital inicial e não o atual.
        // Para simplificar agora, vamos usar um valor fixo ou o investmentAmount como base,
        // mas o ideal é que o StateManager forneça o capital inicial da sessão.
        // POR ENQUANTO: Consideramos a perda sobre o valor total investido no dia, ou sobre um capital inicial fixo se preferir.
        // Uma abordagem mais robusta exigiria o capital inicial do dia.
        const baseCapitalForDailyLoss = this.config.strategy.initialCapital || 1000; // Defina um capital inicial no seu .env ou config

        // Verifica o limite de perda diária
        if (dailyStats.profit < 0 && Math.abs(dailyStats.profit) >= (baseCapitalForDailyLoss * this.maxDailyLossPercentage)) {
            this.logger.warn(`Limite de perda diária atingido! Prejuízo de ${dailyStats.profit.toFixed(2)} USDT excede ${this.maxDailyLossPercentage * 100}% de ${baseCapitalForDailyLoss} USDT.`);
            return { canTrade: false, reason: 'Limite de perda diária atingido.' };
        }

        // Verifica o limite de número de trades diários
        if (dailyStats.trades >= this.maxDailyTrades) {
            this.logger.warn(`Limite de trades diários (${this.maxDailyTrades}) atingido.`);
            return { canTrade: false, reason: 'Limite de trades diários atingido.' };
        }

        this.logger.debug('Limites de risco diários OK para novo trade.');
        return { canTrade: true, reason: 'Limites de risco OK.' };
    }

    /**
     * Verifica as condições de saída de uma posição (Stop Loss, Take Profit, Trailing Stop).
     * @param {object} position - O estado atual da posição (holding, amount, asset).
     * @param {number} entryPrice - O preço de entrada da posição.
     * @param {number} highestPrice - O preço mais alto atingido desde a entrada na posição.
     * @param {number} currentPrice - O preço atual do ativo.
     * @param {number} stopLossPercentage - Porcentagem de Stop Loss (ex: 0.01 para 1%).
     * @param {number} takeProfitPercentage - Porcentagem de Take Profit (ex: 0.02 para 2%).
     * @param {number} trailingStopPercentage - Porcentagem de Trailing Stop (ex: 0.005 para 0.5%).
     * @returns {{reason: string, price: number}|null} Objeto com o motivo da saída e o preço de acionamento, ou null.
     */
    checkExitConditions(position, entryPrice, highestPrice, currentPrice, stopLossPercentage, takeProfitPercentage, trailingStopPercentage) {
        if (!position.holding) {
            return null; // Não há posição para verificar saída
        }

        const currentProfitLossPercentage = ((currentPrice - entryPrice) / entryPrice);

        // 1. Stop Loss Fixo
        if (currentProfitLossPercentage <= -stopLossPercentage) {
            this.logger.warn(`Stop Loss acionado! Preço atual ${currentPrice.toFixed(this.config.strategy.pricePrecision)}, Entrada ${entryPrice.toFixed(this.config.strategy.pricePrecision)}. Perda: ${currentProfitLossPercentage.toFixed(4) * 100}%`);
            return { reason: 'STOP_LOSS', price: currentPrice };
        }

        // 2. Take Profit Fixo
        if (currentProfitLossPercentage >= takeProfitPercentage) {
            this.logger.info(`Take Profit acionado! Preço atual ${currentPrice.toFixed(this.config.strategy.pricePrecision)}, Entrada ${entryPrice.toFixed(this.config.strategy.pricePrecision)}. Lucro: ${currentProfitLossPercentage.toFixed(4) * 100}%`);
            return { reason: 'TAKE_PROFIT', price: currentPrice };
        }

        // 3. Trailing Stop
        // O Trailing Stop só começa a "arrastar" depois que o preço se move a seu favor
        // O ponto de trailing stop é calculado a partir do 'highestPrice'
        const trailingStopPrice = highestPrice * (1 - trailingStopPercentage);
        if (currentPrice <= trailingStopPrice && highestPrice > entryPrice) { // Só aciona se já tivermos lucro ou pelo menos acima do preço de entrada (ajustável)
            this.logger.warn(`Trailing Stop acionado! Preço atual ${currentPrice.toFixed(this.config.strategy.pricePrecision)}, Maior Preço ${highestPrice.toFixed(this.config.strategy.pricePrecision)}. Trailing Stop em ${trailingStopPrice.toFixed(this.config.strategy.pricePrecision)}.`);
            return { reason: 'TRAILING_STOP', price: currentPrice };
        }

        return null; // Nenhuma condição de saída acionada
    }
}

module.exports = RiskManager;