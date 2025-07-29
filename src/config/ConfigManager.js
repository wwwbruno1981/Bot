// src/config/ConfigManager.js
const fs = require('fs');
const path = require('path');

let instance = null; // Variável para armazenar a única instância

class ConfigManager {
    constructor() {
        if (instance) {
            return instance; // Se já existe uma instância, retorna ela
        }

        this.config = {};
        this.loadConfig();

        instance = this; // Armazena a instância recém-criada
    }

    loadConfig() {
        // Carrega variáveis de ambiente primeiro
        this.config.binance = {
            apiKey: process.env.BINANCE_API_KEY,
            apiSecret: process.env.BINANCE_API_SECRET,
            baseURL: process.env.BINANCE_BASE_URL || 'https://api.binance.com',
            wsURL: process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443/ws'
        };

        this.config.telegram = {
            botToken: process.env.TELEGRAM_BOT_TOKEN,
            chatId: process.env.TELEGRAM_CHAT_ID,
            enabled: process.env.TELEGRAM_ENABLED === 'true' // Converte para booleano
        };

        this.config.strategy = {
            symbol: process.env.SYMBOL || 'BTCUSDT',
            interval: process.env.INTERVAL || '1m',
            shortMASize: parseInt(process.env.SHORT_MA_SIZE || '10', 10),
            longMASize: parseInt(process.env.LONG_MA_SIZE || '30', 10),
            investmentAmount: parseFloat(process.env.INVESTMENT_AMOUNT || '10', 10),
            stopLossPercentage: parseFloat(process.env.STOP_LOSS_PERCENTAGE || '0.01', 10),
            takeProfitPercentage: parseFloat(process.env.TAKE_PROFIT_PERCENTAGE || '0.02', 10),
            trailingStopPercentage: parseFloat(process.env.TRAILING_STOP_PERCENTAGE || '0.005', 10),
            pricePrecision: parseInt(process.env.PRICE_PRECISION || '2', 10),
            quantityPrecision: parseInt(process.env.QUANTITY_PRECISION || '5', 10)
        };

        this.config.log = {
            logLevel: process.env.LOG_LEVEL || 'info',
            logSaveToFile: process.env.LOG_SAVE_TO_FILE === 'true',
            logDirectory: process.env.LOG_DIRECTORY || './logs',
            maxFileSize: parseInt(process.env.MAX_LOG_FILE_SIZE_MB || '10', 10) // Em MB
        };

        this.config.notifications = {
            telegram: {
                enabled: process.env.TELEGRAM_ENABLED === 'true',
                alertOnTrade: process.env.ALERT_ON_TRADE === 'true',
                alertOnError: process.env.ALERT_ON_ERROR === 'true',
                alertOnStartStop: process.env.ALERT_ON_START_STOP === 'true'
            }
        };

        this.config.advanced = {
            statusDisplayInterval: parseInt(process.env.STATUS_DISPLAY_INTERVAL_MS || '60000', 10), // 1 minuto
            reconnectionDelay: parseInt(process.env.WS_RECONNECTION_DELAY_MS || '5000', 10), // 5 segundos
            maxReconnectAttempts: parseInt(process.env.WS_MAX_RECONNECT_ATTEMPTS || '5', 10)
        };

        // Você pode adicionar mais grupos de configuração conforme necessário
    }

    getConfig() {
        return this.config;
    }

    // Método estático para obter a única instância do ConfigManager
    static getInstance() {
        if (!instance) {
            instance = new ConfigManager();
        }
        return instance;
    }
}

module.exports = ConfigManager;