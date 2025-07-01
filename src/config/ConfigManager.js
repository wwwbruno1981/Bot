const fs = require('fs');
const path = require('path');
require('dotenv').config();

class ConfigManager {
    constructor() {
        this.config = this.loadConfiguration();
        this.validateConfiguration();
    }

    loadConfiguration() {
        const config = {
            // Configurações da API
            api: {
                apiKey: process.env.BINANCE_API_KEY,
                apiSecret: process.env.BINANCE_API_SECRET,
                baseURL: process.env.BINANCE_BASE_URL || 'https://api.binance.com',
                wsURL: process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443/ws'
            },

            // Configurações de Trading
            trading: {
                symbol: process.env.TRADING_SYMBOL || 'BTCUSDT',
                quantity: parseFloat(process.env.TRADING_QUANTITY) || 0.001,
                shortPeriod: parseInt(process.env.TRADING_SHORT_PERIOD) || 7,
                longPeriod: parseInt(process.env.TRADING_LONG_PERIOD) || 21,
                useEMA: process.env.TRADING_USE_EMA === 'true',
                minProfit: parseFloat(process.env.TRADING_MIN_PROFIT) || 0.5
            },

            // Gerenciamento de Risco
            riskManagement: {
                stopLoss: parseFloat(process.env.RISK_STOP_LOSS) || -2.0,
                takeProfit: parseFloat(process.env.RISK_TAKE_PROFIT) || 3.0,
                trailingStop: process.env.RISK_TRAILING_STOP === 'true',
                trailingStopPercent: parseFloat(process.env.RISK_TRAILING_STOP_PERCENT) || 1.5,
                maxPositions: parseInt(process.env.RISK_MAX_POSITIONS) || 1,
                maxDailyLoss: parseFloat(process.env.RISK_MAX_DAILY_LOSS) || -5.0,
                maxDailyTrades: parseInt(process.env.RISK_MAX_DAILY_TRADES) || 10
            },

            // Notificações
            notifications: {
                telegram: {
                    enabled: process.env.TELEGRAM_ENABLED === 'true',
                    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
                    chatId: process.env.TELEGRAM_CHAT_ID || ''
                }
            },

            // Configurações de Log
            logging: {
                level: process.env.LOG_LEVEL || 'info',
                saveToFile: process.env.LOG_SAVE_TO_FILE === 'true',
                maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE) || 10,
                directory: process.env.LOG_DIRECTORY || './logs'
            },

            // Configurações Avançadas
            advanced: {
                maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 10,
                heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 30000,
                statusDisplayInterval: parseInt(process.env.STATUS_DISPLAY_INTERVAL) || 60000,
                pricePrecision: parseInt(process.env.PRICE_PRECISION) || 8,
                quantityPrecision: parseInt(process.env.QUANTITY_PRECISION) || 6
            },

            // Configurações de Desenvolvimento
            development: {
                nodeEnv: process.env.NODE_ENV || 'production',
                debug: process.env.DEBUG === 'true',
                simulateTrading: process.env.SIMULATE_TRADING === 'true'
            }
        };

        return config;
    }

    validateConfiguration() {
        const errors = [];

        // Validar credenciais da API
        if (!this.config.api.apiKey || this.config.api.apiKey === 'sua_api_key_aqui') {
            errors.push('BINANCE_API_KEY não configurada ou inválida');
        }

        if (!this.config.api.apiSecret || this.config.api.apiSecret === 'sua_api_secret_aqui') {
            errors.push('BINANCE_API_SECRET não configurada ou inválida');
        }

        // Validar parâmetros de trading
        if (this.config.trading.quantity <= 0) {
            errors.push('TRADING_QUANTITY deve ser maior que 0');
        }

        if (this.config.trading.shortPeriod >= this.config.trading.longPeriod) {
            errors.push('TRADING_SHORT_PERIOD deve ser menor que TRADING_LONG_PERIOD');
        }

        // Validar parâmetros de risco
        if (this.config.riskManagement.stopLoss >= 0) {
            errors.push('RISK_STOP_LOSS deve ser negativo');
        }

        if (this.config.riskManagement.takeProfit <= 0) {
            errors.push('RISK_TAKE_PROFIT deve ser positivo');
        }

        // Validar Telegram se habilitado
        if (this.config.notifications.telegram.enabled) {
            if (!this.config.notifications.telegram.botToken) {
                errors.push('TELEGRAM_BOT_TOKEN é obrigatório quando Telegram está habilitado');
            }
            if (!this.config.notifications.telegram.chatId) {
                errors.push('TELEGRAM_CHAT_ID é obrigatório quando Telegram está habilitado');
            }
        }

        if (errors.length > 0) {
            throw new Error(`Erro de configuração:\n${errors.join('\n')}`);
        }

        // Criar diretório de logs se não existir
        if (this.config.logging.saveToFile) {
            this.ensureLogDirectory();
        }
    }

    ensureLogDirectory() {
        const logDir = path.resolve(this.config.logging.directory);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    getConfig() {
        return this.config;
    }

    // Getter para configurações específicas
    getApiConfig() {
        return this.config.api;
    }

    getTradingConfig() {
        return this.config.trading;
    }

    getRiskConfig() {
        return this.config.riskManagement;
    }

    getNotificationConfig() {
        return this.config.notifications;
    }

    getLoggingConfig() {
        return this.config.logging;
    }

    getAdvancedConfig() {
        return this.config.advanced;
    }

    getDevelopmentConfig() {
        return this.config.development;
    }

    // Método para exibir configuração (sem dados sensíveis)
    displayConfig() {
        const safeConfig = JSON.parse(JSON.stringify(this.config));
        
        // Ocultar dados sensíveis
        safeConfig.api.apiKey = this.maskSensitiveData(safeConfig.api.apiKey);
        safeConfig.api.apiSecret = this.maskSensitiveData(safeConfig.api.apiSecret);
        
        if (safeConfig.notifications.telegram.botToken) {
            safeConfig.notifications.telegram.botToken = this.maskSensitiveData(safeConfig.notifications.telegram.botToken);
        }

        return safeConfig;
    }

    maskSensitiveData(data) {
        if (!data || data.length < 8) return '***';
        return data.substring(0, 4) + '*'.repeat(data.length - 8) + data.substring(data.length - 4);
    }

    // Método para salvar configuração de exemplo
    static createExampleEnv() {
        const exampleEnv = `# ===========================================
# CONFIGURAÇÕES DA API BINANCE
# ===========================================
BINANCE_API_KEY=sua_api_key_aqui
BINANCE_API_SECRET=sua_api_secret_aqui
BINANCE_BASE_URL=https://api.binance.com
BINANCE_WS_URL=wss://stream.binance.com:9443/ws

# ===========================================
# CONFIGURAÇÕES DE TRADING
# ===========================================
TRADING_SYMBOL=BTCUSDT
TRADING_QUANTITY=0.001
TRADING_SHORT_PERIOD=7
TRADING_LONG_PERIOD=21
TRADING_USE_EMA=true
TRADING_MIN_PROFIT=0.5

# ===========================================
# GERENCIAMENTO DE RISCO
# ===========================================
RISK_STOP_LOSS=-2.0
RISK_TAKE_PROFIT=3.0
RISK_TRAILING_STOP=true
RISK_TRAILING_STOP_PERCENT=1.5
RISK_MAX_POSITIONS=1
RISK_MAX_DAILY_LOSS=-5.0
RISK_MAX_DAILY_TRADES=10

# ===========================================
# NOTIFICAÇÕES TELEGRAM
# ===========================================
TELEGRAM_ENABLED=false
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# ===========================================
# CONFIGURAÇÕES DE LOG
# ===========================================
LOG_LEVEL=info
LOG_SAVE_TO_FILE=true
LOG_MAX_FILE_SIZE=10
LOG_DIRECTORY=./logs

# ===========================================
# CONFIGURAÇÕES AVANÇADAS
# ===========================================
MAX_RECONNECT_ATTEMPTS=10
HEARTBEAT_INTERVAL=30000
STATUS_DISPLAY_INTERVAL=60000
PRICE_PRECISION=8
QUANTITY_PRECISION=6

# ===========================================
# MODO DE DESENVOLVIMENTO
# ===========================================
NODE_ENV=production
DEBUG=false
SIMULATE_TRADING=false`;

        const envPath = path.resolve('.env');
        if (!fs.existsSync(envPath)) {
            fs.writeFileSync(envPath, exampleEnv);
            console.log('✅ Arquivo .env criado com configurações de exemplo');
            console.log('📝 Configure suas credenciais da API Binance no arquivo .env');
            return true;
        }
        return false;
    }
}

module.exports = ConfigManager;