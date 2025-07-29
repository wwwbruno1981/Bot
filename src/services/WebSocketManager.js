// src/services/WebSocketManager.js
const WebSocket = require('ws');
const Logger = require('../utils/Logger');
const { handleCriticalError } = require('../utils/ErrorHandler');

class WebSocketManager {
    constructor(config, logger, priceUpdateCallback) {
        this.config = config;
        this.logger = logger || new Logger(config);
        this.priceUpdateCallback = priceUpdateCallback; // Callback para o bot principal

        this.wsURL = this.config.binance.wsURL;
        this.reconnectionDelay = this.config.advanced.reconnectionDelay;
        this.maxReconnectAttempts = this.config.advanced.maxReconnectAttempts;

        this.ws = null;
        this.symbol = null;
        this.interval = null;
        this.reconnectAttempts = 0;
        this.isConnected = false;
        this.heartbeatInterval = null;

        this.logger.info('WebSocketManager inicializado.');
    }

    /**
     * Conecta ao WebSocket da Binance para um par e intervalo específicos.
     * @param {string} symbol - O par de negociação (ex: 'btcusdt').
     * @param {string} interval - O intervalo do candle (ex: '1m').
     */
    async connectWebSocket(symbol, interval) {
        this.symbol = symbol.toLowerCase(); // Binance WS usa minúsculas
        this.interval = interval;
        const streamName = `${this.symbol}@kline_${this.interval}`;
        const url = `${this.wsURL}/${streamName}`;

        this.logger.info(`Conectando ao WebSocket: ${url}`);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.logger.warn('Já conectado ao WebSocket. Desconectando antes de reconectar.');
            this.disconnect();
        }

        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            this.logger.info(`✅ Conectado ao WebSocket para ${this.symbol} ${this.interval}.`);
            this.isConnected = true;
            this.reconnectAttempts = 0; // Resetar tentativas de reconexão
            this.setupHeartbeat(); // Iniciar heartbeat
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.e === 'kline') {
                const kline = message.k;
                // Apenas processa o candle se ele estiver fechado (isFinalKLine = true)
                // ou se quisermos o preço em tempo real do candle atual (isFinalKLine = false)
                // Para estratégias de MA, geralmente esperamos o candle fechar.
                if (kline.x) { // kline.x é true se o candle está fechado
                    const processedKline = {
                        open: parseFloat(kline.o),
                        high: parseFloat(kline.h),
                        low: parseFloat(kline.l),
                        close: parseFloat(kline.c),
                        volume: parseFloat(kline.v),
                        openTime: kline.t,
                        closeTime: kline.T,
                        isFinalKLine: kline.x
                    };
                    this.priceUpdateCallback(processedKline); // Chama o callback no bot principal
                }
            }
        };

        this.ws.onerror = (error) => {
            this.logger.error(`Erro no WebSocket para ${this.symbol} ${this.interval}: ${error.message}`);
            this.isConnected = false;
            this.clearHeartbeat(); // Limpar heartbeat em caso de erro
        };

        this.ws.onclose = (event) => {
            this.logger.warn(`WebSocket desconectado para ${this.symbol} ${this.interval}. Código: ${event.code}, Razão: ${event.reason}`);
            this.isConnected = false;
            this.clearHeartbeat(); // Limpar heartbeat ao fechar
            this.handleReconnection(); // Tentar reconectar
        };
    }

    /**
     * Tenta reconectar ao WebSocket após uma desconexão.
     */
    async handleReconnection() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this.logger.info(`Tentando reconectar ao WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => {
                this.connectWebSocket(this.symbol, this.interval);
            }, this.reconnectionDelay);
        } else {
            const errorMsg = `Número máximo de tentativas de reconexão (${this.maxReconnectAttempts}) atingido. Desistindo.`;
            this.logger.critical(errorMsg);
            await handleCriticalError(new Error(errorMsg), 'Falha crítica de conexão WebSocket.');
        }
    }

    /**
     * Configura um heartbeat para manter a conexão WebSocket viva.
     * Binance não exige pings/pongs para streams de dados públicos, mas é uma boa prática.
     * Para streams de usuário, é essencial.
     */
    setupHeartbeat() {
        // Para streams de dados públicos (kline), Binance geralmente não exige pings/pongs
        // Mas para User Data Streams (ordens, saldos), é crucial enviar um ping a cada 3 minutos.
        // Aqui, estamos focando em kline, então um heartbeat simples para logar pode ser suficiente.
        // Se fosse User Data Stream, seria: this.ws.ping();
        this.clearHeartbeat(); // Garante que não há múltiplos heartbeats
        this.heartbeatInterval = setInterval(() => {
            if (this.ws.readyState === WebSocket.OPEN) {
                // this.ws.ping(); // Se a Binance exigisse pings para este stream
                this.logger.debug(`WebSocket Heartbeat: Conexão ${this.symbol} ${this.interval} ativa.`);
            } else {
                this.logger.warn(`WebSocket Heartbeat: Conexão ${this.symbol} ${this.interval} não está aberta.`);
            }
        }, 60 * 1000); // A cada 1 minuto
    }

    /**
     * Limpa o intervalo do heartbeat.
     */
    clearHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            this.logger.debug('Heartbeat do WebSocket limpo.');
        }
    }

    /**
     * Desconecta o WebSocket.
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
            this.clearHeartbeat();
            this.logger.info(`WebSocket para ${this.symbol} ${this.interval} desconectado manualmente.`);
        }
    }
}

module.exports = WebSocketManager;