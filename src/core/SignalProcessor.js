// src/core/SignalProcessor.js
const Logger = require('../utils/Logger');

class SignalProcessor {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger || new Logger(config); // Usa logger passado ou cria um novo

        // Configurações da estratégia
        this.shortMASize = this.config.strategy.shortMASize;
        this.longMASize = this.config.strategy.longMASize;

        // Arrays para armazenar preços e médias móveis
        this.prices = [];
        this.shortMA = [];
        this.longMA = [];

        this.logger.info(`SignalProcessor inicializado. MA Curta: ${this.shortMASize}, MA Longa: ${this.longMASize}`);
    }

    /**
     * Inicializa os arrays de preço e MAs com dados históricos.
     * Deve ser chamado uma vez na inicialização do bot.
     * @param {Array<number>} historicalPrices - Array de preços de fechamento históricos.
     */
    initializeData(historicalPrices) {
        if (!Array.isArray(historicalPrices) || historicalPrices.length === 0) {
            this.logger.warn('Dados históricos inválidos ou vazios para inicializar o SignalProcessor.');
            return;
        }

        // Adiciona os preços históricos aos arrays
        this.prices = historicalPrices;

        // Garante que o array de preços não exceda um tamanho razoável para os cálculos
        // O tamanho deve ser no mínimo o tamanho da MA mais longa.
        // Um buffer adicional pode ser útil para cálculos que olham um pouco para trás.
        const requiredLength = Math.max(this.shortMASize, this.longMASize) * 2; // Ex: o dobro da MA mais longa como buffer
        if (this.prices.length > requiredLength) {
            this.prices = this.prices.slice(-requiredLength);
        }

        // Calcula as MAs iniciais com os dados históricos
        this.calculateMovingAverages();
        this.logger.info(`SignalProcessor inicializado com ${this.prices.length} preços históricos. MAs calculadas.`);
    }

    /**
     * Adiciona um novo preço e recalcula as MAs.
     * Mantém os arrays com tamanho otimizado usando shift().
     * @param {number} newPrice - O novo preço a ser processado.
     */
    processPrice(newPrice) {
        this.prices.push(newPrice);

        // Otimização de memória: remove o preço mais antigo se o array for muito grande
        // O tamanho mínimo deve ser suficiente para calcular a MA longa
        const minPricesRequired = this.longMASize;
        if (this.prices.length > minPricesRequired * 2) { // Mantém um buffer
            this.prices.shift();
        }

        this.calculateMovingAverages();
        return this.checkSignal();
    }

    /**
     * Calcula as médias móveis (EMA e SMA).
     * Esta função será chamada internamente ao processar um novo preço.
     */
    calculateMovingAverages() {
        if (this.prices.length < this.longMASize) {
            // Não há dados suficientes para calcular a MA longa
            this.shortMA = [];
            this.longMA = [];
            return;
        }

        // Calcula a MA curta
        this.shortMA.push(this.calculateEMA(this.prices, this.shortMASize));
        // Otimiza o tamanho do array de shortMA
        if (this.shortMA.length > this.shortMASize * 2) {
            this.shortMA.shift();
        }

        // Calcula a MA longa
        this.longMA.push(this.calculateEMA(this.prices, this.longMASize));
        // Otimiza o tamanho do array de longMA
        if (this.longMA.length > this.longMASize * 2) {
            this.longMA.shift();
        }
    }

    /**
     * Calcula a Exponential Moving Average (EMA).
     * @param {Array<number>} data - Array de preços.
     * @param {number} period - Período da EMA.
     * @returns {number} O valor da EMA.
     */
    calculateEMA(data, period) {
        if (data.length < period) {
            return 0; // Não há dados suficientes para calcular
        }
        const k = 2 / (period + 1);
        let ema = data[0]; // Assume que o primeiro valor é a EMA inicial para simplificar.
                          // Em uma implementação mais robusta, a primeira EMA seria a SMA dos primeiros 'period' valores.

        // Se houver EMA anterior, usa-a. Caso contrário, calcula a SMA para o primeiro ponto.
        // Para simplificar aqui, vamos calcular a SMA se não houver um 'previousEMA' real.
        // Nota: Esta é uma simplificação comum. Para precisão, a primeira EMA é a SMA.
        if (this.prices.length >= period) {
            const initialSlice = data.slice(-period); // Pega os últimos 'period' valores
            ema = initialSlice.reduce((sum, val) => sum + val, 0) / period; // SMA inicial
        }

        for (let i = 1; i < data.length; i++) {
            ema = data[i] * k + ema * (1 - k);
        }
        return ema;
    }

    /**
     * Calcula a Simple Moving Average (SMA).
     * @param {Array<number>} data - Array de preços.
     * @param {number} period - Período da SMA.
     * @returns {number} O valor da SMA.
     */
    calculateSMA(data, period) {
        if (data.length < period) {
            return 0; // Não há dados suficientes para calcular
        }
        const slice = data.slice(-period); // Pega os últimos 'period' valores
        const sum = slice.reduce((acc, val) => acc + val, 0);
        return sum / period;
    }

    /**
     * Verifica as condições para gerar um sinal de compra ou venda.
     * @returns {string|null} 'BUY', 'SELL' ou null.
     */
    checkSignal() {
        if (this.shortMA.length < 2 || this.longMA.length < 2) {
            return null; // Não há MAs suficientes para verificar o cruzamento
        }

        const currentShortMA = this.shortMA[this.shortMA.length - 1];
        const previousShortMA = this.shortMA[this.shortMA.length - 2];
        const currentLongMA = this.longMA[this.longMA.length - 1];
        const previousLongMA = this.longMA[this.longMA.length - 2];

        // Cruzamento de compra (Golden Cross)
        if (previousShortMA <= previousLongMA && currentShortMA > currentLongMA) {
            return 'BUY';
        }

        // Cruzamento de venda (Death Cross)
        if (previousShortMA >= previousLongMA && currentShortMA < currentLongMA) {
            return 'SELL';
        }

        return null; // Nenhum sinal detectado
    }

    /**
     * Retorna os valores atuais das MAs para fins de debug/status.
     * @returns {object} Objeto contendo os últimos valores das MAs.
     */
    getCurrentMAs() {
        return {
            shortMA: this.shortMA.length > 0 ? this.shortMA[this.shortMA.length - 1] : 0,
            longMA: this.longMA.length > 0 ? this.longMA[this.longMA.length - 1] : 0,
            pricesLength: this.prices.length
        };
    }
}

module.exports = SignalProcessor;