// src/core/BinanceTradingBot.js
const ConfigManager = require('../config/ConfigManager');
const Logger = require('../utils/Logger');
const { handleCriticalError, initializeErrorHandler } = require('../utils/ErrorHandler'); // Importa o ErrorHandler e seu inicializador

// Importa os novos serviços e módulos do core
const BinanceAPIService = require('../services/BinanceAPIService');
const WebSocketManager = require('../services/WebSocketManager');
const TelegramService = require('../services/TelegramService');
const StateManager = require('../services/StateManager'); // Ainda será implementado
const SignalProcessor = require('./SignalProcessor'); // Ainda será implementado
const RiskManager = require('./RiskManager');     // Ainda será implementado
const TradeExecutor = require('./TradeExecutor');   // Ainda será implementado

class BinanceTradingBot {
    constructor() {
        this.isStarting = false;
        this.isInitialized = false;

        // 1. Inicializa o ConfigManager (singleton)
        this.config = ConfigManager.getInstance().getConfig();

        // 2. Inicializa o Logger com a configuração
        this.logger = new Logger(this.config);

        // 3. Inicializa o TelegramService e o ErrorHandler
        this.telegramService = new TelegramService(this.config);
        initializeErrorHandler(this.telegramService); // Injeta o TelegramService no ErrorHandler

        // 4. Inicializa os serviços e módulos do core, passando as dependências
        this.binanceAPIService = new BinanceAPIService(this.config);
        // O WebSocketManager precisará de um callback para processar novos preços
        this.webSocketManager = new WebSocketManager(this.config, this.logger, this.processNewPrice.bind(this));
        this.stateManager = new StateManager(this.config, this.logger); // Passa config e logger
        this.signalProcessor = new SignalProcessor(this.config, this.logger); // SignalProcessor gerenciará seus próprios dados de preço
        this.riskManager = new RiskManager(this.config, this.logger);
        this.tradeExecutor = new TradeExecutor(this.config, this.logger, this.binanceAPIService, this.stateManager);

        // Variáveis de estado do bot (serão carregadas/salvas pelo StateManager)
        // Por enquanto, inicialize com valores padrão
        this.position = { holding: false, amount: 0, asset: this.config.strategy.symbol.replace('USDT', ''), quoteAsset: 'USDT' };
        this.entryPrice = 0;
        this.highestPrice = 0;
        this.lastPrice = 0;
        this.dailyStats = {
            trades: 0,
            profit: 0,
            startTime: Date.now(),
            dailyProfits: [] // Para registrar lucros diários históricos
        };
        this.accountBalances = {}; // Para armazenar o balanço dos ativos
        this.symbolInfo = {}; // Armazenará informações do exchangeInfo para o par de trading

        this.statusInterval = null; // Para o setInterval do status
    }

    async init() {
        if (this.isStarting) {
            this.logger.warn('Inicialização já em progresso, ignorando...');
            return;
        }

        this.isStarting = true;
        this.logger.info('Iniciando o Binance Trading Bot...');

        try {
            // Carregar estado salvo do DB (via StateManager)
            // O StateManager precisará de acesso ao 'this' para atualizar as variáveis de estado
            await this.stateManager.loadState(this); // Passa 'this' para o StateManager para que ele possa atualizar o bot

            // Obter informações da exchange (precisão, limites, etc.)
            this.symbolInfo = await this.binanceAPIService.getExchangeInfo();
            this.symbolInfo = this.symbolInfo.symbols.find(s => s.symbol === this.config.strategy.symbol);
            if (!this.symbolInfo) {
                throw new Error(`Informações da exchange para o símbolo ${this.config.strategy.symbol} não encontradas.`);
            }
            this.logger.info(`Informações do símbolo ${this.config.strategy.symbol} carregadas.`, { filters: this.symbolInfo.filters });


            // Obter balanço inicial
            this.accountBalances[this.position.asset] = await this.binanceAPIService.getBalance(this.position.asset);
            this.accountBalances[this.position.quoteAsset] = await this.binanceAPIService.getBalance(this.position.quoteAsset);
            this.logger.balance('Balanço inicial:', this.accountBalances);


            // Carregar dados históricos para o SignalProcessor (necessário para MAs iniciais)
            // O SignalProcessor agora gerencia seus próprios dados
            const historicalData = await this.binanceAPIService.getHistoricalData(
                this.config.strategy.symbol,
                this.config.strategy.interval,
                this.config.strategy.longMASize * 2 // Carregar dados suficientes para calcular MAs
            );
            this.signalProcessor.initializeData(historicalData.map(k => k.close)); // Inicializa o SignalProcessor com preços de fechamento

            // Conectar ao WebSocket
            await this.webSocketManager.connectWebSocket(this.config.strategy.symbol, this.config.strategy.interval);

            // Notificar Telegram sobre o início (se habilitado)
            if (this.config.notifications.telegram.enabled && this.config.notifications.telegram.alertOnStartStop) {
                await this.telegramService.sendTelegramNotification(`🚀 *Bot de Trading Iniciado!*`);
            }

            this.isInitialized = true;
            this.logger.info('✅ Bot inicializado e pronto para operar.');

            // Configurar exibição de status periódico
            this.statusInterval = setInterval(() => this.displayStatus(), this.config.advanced.statusDisplayInterval);

        } catch (error) {
            // Usa o ErrorHandler para erros críticos na inicialização
            await handleCriticalError(error, 'Erro durante a inicialização do bot principal');
        } finally {
            this.isStarting = false;
        }
    }

    // Este método será o callback do WebSocketManager
    async processNewPrice(kline) {
        if (!this.isInitialized) {
            this.logger.debug('Bot não inicializado, ignorando novo preço.');
            return;
        }

        // Atualiza o último preço recebido
        this.lastPrice = kline.close;
        this.logger.debug(`Novo preço recebido: ${this.lastPrice}`);

        try {
            // 1. Processar o sinal de trading
            const signal = this.signalProcessor.processPrice(this.lastPrice);
            if (signal) {
                this.logger.signal(`Sinal detectado: ${signal}`);
            }

            // 2. Verificar condições de saída (Stop Loss, Take Profit, Trailing Stop)
            // O RiskManager precisará do estado da posição e do preço atual
            const exitAction = this.riskManager.checkExitConditions(
                this.position,
                this.entryPrice,
                this.highestPrice,
                this.lastPrice,
                this.config.strategy.stopLossPercentage,
                this.config.strategy.takeProfitPercentage,
                this.config.strategy.trailingStopPercentage
            );

            if (exitAction) {
                this.logger.warn(`Condição de saída detectada: ${exitAction.reason}.`);
                // Executar ordem de venda via TradeExecutor
                await this.tradeExecutor.executeSellOrder(
                    this.position,
                    this.lastPrice,
                    this.symbolInfo, // Passa infos do símbolo para validação de ordem
                    this.accountBalances[this.position.asset].free, // Saldo disponível para venda
                    exitAction.reason // Motivo da saída
                );
                this.position.holding = false;
                this.position.amount = 0;
                this.entryPrice = 0;
                this.highestPrice = 0;
                // Salvar estado após a venda
                await this.stateManager.saveState(this);
            }

            // 3. Se não houver posição e um sinal de compra, executar compra
            if (!this.position.holding && signal === 'BUY') {
                // Verificar limites de risco diários
                const riskCheck = this.riskManager.checkDailyRiskLimits(this.dailyStats, this.config.strategy.investmentAmount);
                if (riskCheck.canTrade) {
                    this.logger.info(`Sinal de compra e limites de risco ok. Preparando compra.`);
                    // Executar ordem de compra via TradeExecutor
                    const orderResult = await this.tradeExecutor.executeBuyOrder(
                        this.config.strategy.symbol,
                        this.config.strategy.investmentAmount,
                        this.lastPrice,
                        this.symbolInfo, // Passa infos do símbolo para validação de ordem
                        this.accountBalances[this.position.quoteAsset].free // Saldo USDT disponível
                    );
                    if (orderResult) {
                        this.position.holding = true;
                        this.position.amount = orderResult.executedQty;
                        this.entryPrice = orderResult.avgPrice; // Usar preço médio executado
                        this.highestPrice = this.entryPrice; // Inicializar highestPrice
                        this.dailyStats.trades++; // Incrementar trades diários
                        // Salvar estado após a compra
                        await this.stateManager.saveState(this);
                    }
                } else {
                    this.logger.warn(`Não é possível comprar: ${riskCheck.reason}`);
                }
            }

            // 4. Atualizar highestPrice se em posição
            if (this.position.holding && this.lastPrice > this.highestPrice) {
                this.highestPrice = this.lastPrice;
            }

        } catch (error) {
            // Usa o ErrorHandler para erros durante o processamento de preço
            await handleCriticalError(error, `Erro ao processar novo preço para ${this.config.strategy.symbol}`);
        }
    }

    displayStatus() {
        const { symbol, investmentAmount } = this.config.strategy;
        const { holding, amount, asset } = this.position;
        const { trades, profit } = this.dailyStats;

        let statusMessage = `*🤖 STATUS DO BOT - ${symbol}*\n`;
        statusMessage += `*Último Preço:* ${this.lastPrice.toFixed(this.config.strategy.pricePrecision)}\n`;

        if (holding) {
            statusMessage += `*Posição:* Comprado (${amount.toFixed(this.config.strategy.quantityPrecision)} ${asset})\n`;
            statusMessage += `*Preço de Entrada:* ${this.entryPrice.toFixed(this.config.strategy.pricePrecision)}\n`;
            statusMessage += `*Preço Mais Alto (desde entrada):* ${this.highestPrice.toFixed(this.config.strategy.pricePrecision)}\n`;

            const currentProfit = ((this.lastPrice - this.entryPrice) / this.entryPrice) * 100;
            statusMessage += `*Lucro Atual (%):* ${currentProfit.toFixed(2)}%\n`;
        } else {
            statusMessage += `*Posição:* Sem Posição\n`;
        }

        statusMessage += `*Trades Hoje:* ${trades}\n`;
        statusMessage += `*Lucro Realizado Hoje:* ${profit.toFixed(2)} USDT\n`;

        // Adiciona informações de balanço
        const baseBalance = this.accountBalances[this.position.asset] ? this.accountBalances[this.position.asset].free : 'N/A';
        const quoteBalance = this.accountBalances[this.position.quoteAsset] ? this.accountBalances[this.position.quoteAsset].free : 'N/A';
        statusMessage += `*Balanço ${this.position.asset}:* ${baseBalance.toFixed(this.config.strategy.quantityPrecision)}\n`;
        statusMessage += `*Balanço ${this.position.quoteAsset}:* ${quoteBalance.toFixed(this.config.strategy.pricePrecision)}\n`;

        this.logger.status(statusMessage, {
            lastPrice: this.lastPrice,
            positionHolding: holding,
            positionAmount: amount,
            entryPrice: this.entryPrice,
            highestPrice: this.highestPrice,
            dailyTrades: trades,
            dailyProfit: profit,
            assetBalance: baseBalance,
            quoteBalance: quoteBalance
        });

        if (this.config.notifications.telegram.enabled) {
            this.telegramService.sendTelegramNotification(statusMessage);
        }
    }

    // Em um ambiente de produção, você pode querer implementar um graceful shutdown
    async stop() {
        this.logger.info('Desligando o bot...');
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
        }
        if (this.webSocketManager) {
            this.webSocketManager.disconnect();
        }
        // Salvar estado final
        await this.stateManager.saveState(this);

        if (this.config.notifications.telegram.enabled && this.config.notifications.telegram.alertOnStartStop) {
            await this.telegramService.sendTelegramNotification(`❌ *Bot de Trading Desligado!*`);
        }
        this.logger.info('Bot desligado com sucesso.');
    }

    // Métodos que serão movidos para outras classes serão removidos daqui!
    // Por exemplo: calculateEMA, calculateSMA, checkSignal, buyOrder, sellOrder, checkDailyRiskLimits, checkExitConditions
    // Já não devem mais estar aqui.
}

module.exports = BinanceTradingBot;