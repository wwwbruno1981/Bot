const axios = require('axios');
const crypto = require('crypto');
const WebSocket = require('ws');
const moment = require('moment');
const ConfigManager = require('./config/ConfigManager');
const Logger = require('./utils/Logger');
const fs = require('fs');
const path = require('path');
const requiredFiles = [
    './utils/Logger.js',
    './config/ConfigManager.js'
];

for (const file of requiredFiles) {
    if (!fs.existsSync(path.resolve(__dirname, file))) {
        console.error(`❌ Arquivo necessário não encontrado: ${file}`);
        process.exit(1);
    }
}

class BinanceTradingBot {
    constructor() {
        // Inicializar configuração e logger
        this.configManager = new ConfigManager();
        this.config = this.configManager.getConfig();
        this.logger = new Logger(this.config);

        // Estados do bot
        this.prices = [];
        this.shortMA = [];
        this.longMA = [];
        this.position = null;
        this.lastPrice = 0;
        this.entryPrice = 0;
        this.highestPrice = 0;
        this.isInitialized = false;
        this.orderInProgress = false;
        this.reconnectAttempts = 0;
        
        // Controles de risco diário
        this.dailyStats = {
            trades: 0,
            profit: 0,
            startTime: moment().startOf('day')
        };

        // WebSocket reference
        this.ws = null;
        this.statusInterval = null;
        this.heartbeatInterval = null;

        
    }
async init() {
    if (this.isStarting) {
        this.logger.warn('Inicialização já em progresso, ignorando...');
        return;
    }
    this.isStarting = true;
    
    try {
        // ... resto do código continua igual
    } catch (error) {
        this.isStarting = false; // Reset em caso de erro
        // ... resto do tratamento de erro
    }
}
    // Assinar requisição para API da Binance
    signRequest(queryString) {
        return crypto
            .createHmac('sha256', this.config.api.apiSecret)
            .update(queryString)
            .digest('hex');
    }

    // Fazer requisição autenticada com retry
    async authenticatedRequest(method, endpoint, params = {}, retries = 3) {
        const timestamp = Date.now();
        const queryString = new URLSearchParams({
            ...params,
            timestamp: timestamp
        }).toString();

        const signature = this.signRequest(queryString);
        const finalQuery = `${queryString}&signature=${signature}`;

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const config = {
                    method: method,
                    url: `${this.config.api.baseURL}${endpoint}?${finalQuery}`,
                    headers: {
                        'X-MBX-APIKEY': this.config.api.apiKey
                    },
                    timeout: 10000
                };

                const response = await axios(config);
                return response.data;
            } catch (error) {
                this.logger.warn(`Tentativa ${attempt}/${retries} falhou`, { 
                    endpoint, 
                    error: error.message 
                });

                if (attempt === retries) {
                    this.logger.error('Todas as tentativas de requisição falharam');
                    throw error;
                }

                await this.sleep(1000 * attempt);
            }
        }
    }

    // Função sleep
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Obter dados históricos de preços
    async getHistoricalData() {
        try {
            const response = await axios.get(`${this.config.api.baseURL}/api/v3/klines`, {
                params: {
                    symbol: this.config.trading.symbol,
                    interval: '1m',
                    limit: Math.max(this.config.trading.longPeriod + 10, 100)
                }
            });

        // Verificar se recebemos dados válidos
        if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        throw new Error('Dados históricos inválidos ou vazios recebidos da API');
            }
            const prices = response.data.map(candle => parseFloat(candle[4]));
            this.prices = prices;
            this.lastPrice = prices[prices.length - 1];
            this.calculateMovingAverages();
            this.isInitialized = true;

            this.logger.info(`Dados históricos carregados`, { 
                symbol: this.config.trading.symbol,
                currentPrice: this.lastPrice,
                dataPoints: prices.length
            });
        } catch (error) {
            this.logger.error('Erro ao obter dados históricos', { error: error.message });
            throw error;
        }
    }

    // Calcular médias móveis (SMA ou EMA)
    calculateMovingAverages() {
        if (this.prices.length < this.config.trading.longPeriod) return;

        if (this.config.trading.useEMA) {
            this.calculateEMA();
        } else {
            this.calculateSMA();
        }
    }

    // Calcular EMA
    calculateEMA() {

    // Verificar se currentPrice é válido
    if (!this.prices || this.prices.length === 0) return;
        const shortAlpha = 2 / (this.config.trading.shortPeriod + 1);
        const longAlpha = 2 / (this.config.trading.longPeriod + 1);
        const currentPrice = this.prices[this.prices.length - 1];

        if (this.shortMA.length === 0) {
            const shortSum = this.prices.slice(-this.config.trading.shortPeriod).reduce((a, b) => a + b, 0);
            this.shortMA.push(shortSum / this.config.trading.shortPeriod);
        } else {
            const prevShortEMA = this.shortMA[this.shortMA.length - 1];
            const newShortEMA = (currentPrice * shortAlpha) + (prevShortEMA * (1 - shortAlpha));
            this.shortMA.push(newShortEMA);
        }

        if (this.longMA.length === 0 && this.prices.length >= this.config.trading.longPeriod) {
            const longSum = this.prices.slice(-this.config.trading.longPeriod).reduce((a, b) => a + b, 0);
            this.longMA.push(longSum / this.config.trading.longPeriod);
        } else if (this.longMA.length > 0) {
            const prevLongEMA = this.longMA[this.longMA.length - 1];
            const newLongEMA = (currentPrice * longAlpha) + (prevLongEMA * (1 - longAlpha));
            this.longMA.push(newLongEMA);
        }

        // Manter apenas últimos 50 valores
        if (this.shortMA.length > 50) this.shortMA.shift();
        if (this.longMA.length > 50) this.longMA.shift();
    }

    // Calcular SMA
    calculateSMA() {
        const shortSum = this.prices.slice(-this.config.trading.shortPeriod).reduce((a, b) => a + b, 0);
        const shortMA = shortSum / this.config.trading.shortPeriod;
        this.shortMA.push(shortMA);

        const longSum = this.prices.slice(-this.config.trading.longPeriod).reduce((a, b) => a + b, 0);
        const longMA = longSum / this.config.trading.longPeriod;
        this.longMA.push(longMA);

        if (this.shortMA.length > 50) this.shortMA.shift();
        if (this.longMA.length > 50) this.longMA.shift();
    }

    // Verificar sinal de compra/venda
    checkSignal() {
        if (this.shortMA.length < 2 || this.longMA.length < 2) return null;

        const currentShortMA = this.shortMA[this.shortMA.length - 1];
        const currentLongMA = this.longMA[this.longMA.length - 1];
        const prevShortMA = this.shortMA[this.shortMA.length - 2];
        const prevLongMA = this.longMA[this.longMA.length - 2];

        // Cruzamento para cima (sinal de compra)
        if (prevShortMA <= prevLongMA && currentShortMA > currentLongMA) {
            return 'BUY';
        }

        // Cruzamento para baixo (sinal de venda)
        if (prevShortMA >= prevLongMA && currentShortMA < currentLongMA) {
            return 'SELL';
        }

        return null;
    }

    // Verificar controles de risco diário
    checkDailyRiskLimits() {
        // Resetar estatísticas se for um novo dia
        const today = moment().startOf('day');
        if (!today.isSame(this.dailyStats.startTime)) {
            this.dailyStats = {
                trades: 0,
                profit: 0,
                startTime: today
            };
            this.logger.info('Estatísticas diárias resetadas');
        }

        // Verificar limite de trades diários
        if (this.dailyStats.trades >= this.config.riskManagement.maxDailyTrades) {
            this.logger.warn('Limite diário de trades atingido', { 
                dailyTrades: this.dailyStats.trades,
                maxTrades: this.config.riskManagement.maxDailyTrades
            });
            return false;
        }

        // Verificar limite de perda diária
        if (this.dailyStats.profit <= this.config.riskManagement.maxDailyLoss) {
            this.logger.warn('Limite diário de perda atingido', { 
                dailyProfit: this.dailyStats.profit,
                maxLoss: this.config.riskManagement.maxDailyLoss
            });
            return false;
        }

        return true;
    }

    // Obter saldo da conta
    async getBalance() {
        try {
            const account = await this.authenticatedRequest('GET', '/api/v3/account');
            const btcBalance = account.balances.find(b => b.asset === this.config.trading.symbol.replace('USDT', ''));
            const usdtBalance = account.balances.find(b => b.asset === 'USDT');

            const balances = {
                BTC: parseFloat(btcBalance?.free || 0),
                USDT: parseFloat(usdtBalance?.free || 0)
            };

            this.logger.balance(balances);
            return balances;
        } catch (error) {
            this.logger.error('Erro ao obter saldo', { error: error.message });
            return { BTC: 0, USDT: 0 };
        }
    }

    // Executar ordem de compra
    async buyOrder() {
        if (this.orderInProgress) {
            this.logger.warn('Ordem já em progresso, ignorando nova ordem de compra');
            return false;
        }

        // Verificar limites de risco diário
        if (!this.checkDailyRiskLimits()) {
            return false;
        }

        this.orderInProgress = true;

        try {
            if (!this.isInitialized || this.lastPrice <= 0) {
                this.logger.warn('Bot não inicializado ou preço inválido para compra');
                return false;
            }

            // Verificar se já temos posição máxima
            if (this.position && this.config.riskManagement.maxPositions <= 1) {
                this.logger.warn('Já existe uma posição aberta');
                return false;
            }

            const balance = await this.getBalance();
            const requiredAmount = this.config.trading.quantity * this.lastPrice;

            if (balance.USDT < requiredAmount) {
                this.logger.warn('Saldo insuficiente', { 
                    required: requiredAmount,
                    available: balance.USDT
                });
                return false;
            }

            // Modo simulação
            if (this.config.development.simulateTrading) {
                this.logger.info('🎮 SIMULAÇÃO - Ordem de compra executada', {
                    symbol: this.config.trading.symbol,
                    quantity: this.config.trading.quantity,
                    price: this.lastPrice
                });
            } else {
                const order = await this.authenticatedRequest('POST', '/api/v3/order', {
                    symbol: this.config.trading.symbol,
                    side: 'BUY',
                    type: 'MARKET',
                    quantity: this.config.trading.quantity.toFixed(this.config.advanced.quantityPrecision)
                });

                this.logger.trade('BUY', {
                    symbol: this.config.trading.symbol,
                    quantity: this.config.trading.quantity,
                    price: this.lastPrice,
                    orderId: order.orderId
                });
            }

            this.position = 'long';
            this.entryPrice = this.lastPrice;
            this.highestPrice = this.lastPrice;
            this.dailyStats.trades++;

            await this.sendTelegramNotification(`✅ COMPRA executada: ${this.config.trading.quantity} ${this.config.trading.symbol} a ${this.lastPrice}`);

            return true;
        } catch (error) {
            this.logger.error('Erro na ordem de compra', { error: error.message });
            return false;
        } finally {
            this.orderInProgress = false;
        }
    }

    // Executar ordem de venda
    async sellOrder(reason = 'Sinal') {
        if (this.orderInProgress) {
            this.logger.warn('Ordem já em progresso, ignorando nova ordem de venda');
            return false;
        }

        this.orderInProgress = true;

        try {
            if (this.lastPrice <= 0 || this.entryPrice <= 0) {
                this.logger.warn('Preços inválidos para venda');
                return false;
            }

            const balance = await this.getBalance();

            if (balance.BTC < this.config.trading.quantity) {
                this.logger.warn('Saldo insuficiente para venda', { 
                    required: this.config.trading.quantity,
                    available: balance.BTC
                });
                return false;
            }

            const profit = ((this.lastPrice - this.entryPrice) / this.entryPrice) * 100;

            // Modo simulação
            if (this.config.development.simulateTrading) {
                this.logger.info('🎮 SIMULAÇÃO - Ordem de venda executada', {
                    symbol: this.config.trading.symbol,
                    quantity: this.config.trading.quantity,
                    price: this.lastPrice,
                    reason: reason
                });
            } else {
                const order = await this.authenticatedRequest('POST', '/api/v3/order', {
                    symbol: this.config.trading.symbol,
                    side: 'SELL',
                    type: 'MARKET',
                    quantity: this.config.trading.quantity.toFixed(this.config.advanced.quantityPrecision)
                });

                this.logger.trade('SELL', {
                    symbol: this.config.trading.symbol,
                    quantity: this.config.trading.quantity,
                    price: this.lastPrice,
                    reason: reason,
                    orderId: order.orderId
                });
            }

            this.logger.profit({
                profit: profit,
                entryPrice: this.entryPrice,
                exitPrice: this.lastPrice,
                reason: reason
            });

            this.position = null;
            this.entryPrice = 0;
            this.highestPrice = 0;
            this.dailyStats.profit += profit;

            await this.sendTelegramNotification(`✅ VENDA executada (${reason}): ${this.config.trading.quantity} ${this.config.trading.symbol} a ${this.lastPrice} | Lucro: ${profit.toFixed(2)}%`);

            return true;
        } catch (error) {
            this.logger.error('Erro na ordem de venda', { error: error.message });
            return false;
        } finally {
            this.orderInProgress = false;
        }
    }

    // Verificar condições de saída (stop loss, take profit, trailing stop)
    checkExitConditions() {
        if (!this.position || this.entryPrice === 0) return null;

        const profitPercent = ((this.lastPrice - this.entryPrice) / this.entryPrice) * 100;

        // Atualizar maior preço para trailing stop
        if (this.config.riskManagement.trailingStop && this.lastPrice > this.highestPrice) {
            this.highestPrice = this.lastPrice;
        }

        // Stop Loss
        if (profitPercent <= this.config.riskManagement.stopLoss) {
            this.logger.warn(`Stop Loss ativado: ${profitPercent.toFixed(2)}%`);
            return 'Stop Loss';
        }

        // Take Profit
        if (profitPercent >= this.config.riskManagement.takeProfit) {
            this.logger.info(`Take Profit ativado: ${profitPercent.toFixed(2)}%`);
            return 'Take Profit';
        }

        // Trailing Stop
        if (this.config.riskManagement.trailingStop && this.highestPrice > this.entryPrice) {
            const trailingStopPrice = this.highestPrice * (1 - this.config.riskManagement.trailingStopPercent / 100);
            if (this.lastPrice <= trailingStopPrice) {
                this.logger.info(`Trailing Stop ativado: Preço caiu de ${this.highestPrice} para ${this.lastPrice}`);
                return 'Trailing Stop';
            }
        }

        return null;
    }

    // Processar nova vela/preço
    async processNewPrice(price) {
        try {
            this.lastPrice = parseFloat(price.toFixed(this.config.advanced.pricePrecision));
            this.prices.push(this.lastPrice);

            if (this.prices.length > 200) this.prices.shift();

            this.calculateMovingAverages();

            // Verificar condições de saída primeiro
            const exitReason = this.checkExitConditions();
            if (exitReason && this.position === 'long') {
                await this.sellOrder(exitReason);
                return;
            }

            // Verificar novos sinais apenas se não há posição aberta e bot está inicializado
            if (!this.position && this.isInitialized && !this.orderInProgress) {
                const signal = this.checkSignal();

                if (signal === 'BUY') {
                    this.logger.signal('COMPRA', {
                        symbol: this.config.trading.symbol,
                        price: this.lastPrice,
                        shortMA: this.shortMA[this.shortMA.length - 1],
                        longMA: this.longMA[this.longMA.length - 1]
                    });
                    await this.buyOrder();
                } else if (signal === 'SELL' && this.position) {
                    this.logger.signal('VENDA', {
                        symbol: this.config.trading.symbol,
                        price: this.lastPrice,
                        shortMA: this.shortMA[this.shortMA.length - 1],
                        longMA: this.longMA[this.longMA.length - 1]
                    });
                    await this.sellOrder('Sinal');
                }
            }
        } catch (error) {
            this.logger.error('Erro ao processar novo preço', { error: error.message });
        }
    }

    // Exibir status atual
    displayStatus() {
        try {
            const currentShortMA = this.shortMA[this.shortMA.length - 1];
            const currentLongMA = this.longMA[this.longMA.length - 1];

            const status = {
                symbol: this.config.trading.symbol,
                currentPrice: this.lastPrice,
                shortPeriod: this.config.trading.shortPeriod,
                longPeriod: this.config.trading.longPeriod,
                shortMA: currentShortMA?.toFixed(2),
                longMA: currentLongMA?.toFixed(2),
                position: this.position,
                entryPrice: this.entryPrice,
                profit: this.position && this.entryPrice > 0 ? ((this.lastPrice - this.entryPrice) / this.entryPrice) * 100 : 0,
                highestPrice: this.highestPrice,
                trailingStop: this.config.riskManagement.trailingStop,
                trailingStopPrice: this.config.riskManagement.trailingStop && this.highestPrice > this.entryPrice 
                    ? this.highestPrice * (1 - this.config.riskManagement.trailingStopPercent / 100) 
                    : 0
            };

            this.logger.status(status);
        } catch (error) {
            this.logger.error('Erro ao exibir status', { error: error.message });
        }
    }
/**
 * Envia uma notificação para o Telegram, caso esteja habilitado na configuração.
 * 
 * @param {string} message - A mensagem a ser enviada.
 */
async sendTelegramNotification(message) {
    const telegramConfig = this.config.notifications?.telegram;

    if (!telegramConfig?.enabled) return;

    const { botToken, chatId } = telegramConfig;

    if (!botToken || !chatId) {
        this.logger.warn('❗ BotToken ou ChatId do Telegram não configurados.');
        return;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload = {
        chat_id: chatId,
        text: `🤖 *Trading Bot*\n\n${message}`,
        parse_mode: 'Markdown'
    };

    try {
        await axios.post(url, payload);
    } catch (error) {
        this.logger.error('❌ Erro ao enviar notificação para o Telegram', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
    }
}

    // Conectar ao WebSocket da Binance
    connectWebSocket() {
        try {
            const wsUrl = `${this.config.api.wsURL}/${this.config.trading.symbol.toLowerCase()}@kline_1m`;
            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                this.logger.info('📡 Conectado ao WebSocket da Binance');
                this.reconnectAttempts = 0;
                this.setupHeartbeat();
            });

            this.ws.on('message', async (data) => {
                try {
                    const kline = JSON.parse(data);

                    if (kline.k && kline.k.x) { // Vela fechada
                        const closePrice = parseFloat(kline.k.c);
                        await this.processNewPrice(closePrice);
                    }
                } catch (error) {
                    this.logger.error('Erro ao processar mensagem WebSocket', { error: error.message });
                }
            });

            this.ws.on('error', (error) => {
                this.logger.error('Erro no WebSocket', { error: error.message });
            });

            this.ws.on('close', () => {
                this.logger.warn('🔌 Conexão WebSocket fechada');
                this.clearHeartbeat();
                this.handleReconnection();
            });

        } catch (error) {
            this.logger.error('Erro ao conectar WebSocket', { error: error.message });
            this.handleReconnection();
        }
    }

    // Configurar heartbeat para manter conexão
    setupHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.ping();
            }
        }, this.config.advanced.heartbeatInterval);
    }

    // Limpar heartbeat
    clearHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    // Gerenciar reconexão
    handleReconnection() {
        if (this.reconnectAttempts >= this.config.advanced.maxReconnectAttempts) {
            this.logger.error('Máximo de tentativas de reconexão atingido. Parando o bot.');
            process.exit(1);
        }

        this.reconnectAttempts++;
        const delay = Math.min(5000 * this.reconnectAttempts, 30000);

        this.logger.info(`Tentativa de reconexão ${this.reconnectAttempts}/${this.config.advanced.maxReconnectAttempts} em ${delay/1000}s`);

        setTimeout(() => {
            this.connectWebSocket();
        }, delay);
    }

    // Reinicialização automática em caso de erro crítico
    async handleCriticalError(error) {
        this.logger.error('Erro crítico detectado', { error: error.message });
        await this.sendTelegramNotification(`⚠️ Erro crítico: ${error.message}\nTentando reinicializar...`);

        try {
            // Resetar estados
            this.isInitialized = false;
            this.orderInProgress = false;

            // Fechar conexões
            if (this.ws) {
                this.ws.close();
            }
            this.clearHeartbeat();

            // Aguardar e tentar reinicializar
            await this.sleep(5000);
            await this.init();
        } catch (reinitError) {
            this.logger.error('Falha na reinicialização', { error: reinitError.message });
            process.exit(1);
        }
    }

    // Inicializar bot
    async init() {
        try {
            this.logger.startup(this.config);

            // Verificar se arquivo .env existe
            if (!this.config.api.apiKey || this.config.api.apiKey === 'sua_api_key_aqui') {
                throw new Error('Configure suas credenciais da API Binance no arquivo .env');
            }

            await this.getHistoricalData();

            const balance = await this.getBalance();
            this.logger.info(`Saldo inicial obtido`, { balance });

            this.connectWebSocket();

            // Status periódico
            this.statusInterval = setInterval(() => {
                if (this.lastPrice > 0) {
                    this.displayStatus();
                }
            }, this.config.advanced.statusDisplayInterval);

            // Limpeza de logs
            this.logger.cleanup();

            // Notificação de início
            await this.sendTelegramNotification('🚀 Bot de Trading iniciado com sucesso!');

        } catch (error) {
            this.logger.error('Erro na inicialização', { error: error.message });
            await this.handleCriticalError(error);
        }
    }

    // Parar bot graciosamente
    async stop() {
        this.logger.info('🛑 Parando o bot...');

        // Limpar intervalos
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
        }
        this.clearHeartbeat();

        // Fechar WebSocket
        if (this.ws) {
            this.ws.close();
        }

        // Relatório final
        this.logger.info('Relatório final', {
            dailyTrades: this.dailyStats.trades,
            dailyProfit: this.dailyStats.profit,
            currentPosition: this.position
        });

        await this.sendTelegramNotification('🛑 Bot de Trading parado');
        process.exit(0);
    }
}

// Verificar se o arquivo .env existe

if (!require('fs').existsSync('.env')) {
    console.log('⚠️  Arquivo .env não encontrado. Criando arquivo de exemplo...');
    ConfigManager.createExampleEnv();
    console.log('📝 Configure suas credenciais no arquivo .env antes de executar o bot novamente.');
    process.exit(1);
}

// Configuração e inicialização
const bot = new BinanceTradingBot();

// Tratamento de sinais do sistema
process.on('SIGINT', () => bot.stop());
process.on('SIGTERM', () => bot.stop());

// Tratamento de erros não capturados
process.on('uncaughtException', async (error) => {
    console.error('Erro não capturado:', error);
    await bot.handleCriticalError(error);
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('Promise rejeitada:', reason);
    await bot.handleCriticalError(new Error(`Promise rejeitada: ${reason}`));
});

module.exports = BinanceTradingBot;