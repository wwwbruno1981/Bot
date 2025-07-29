// src/services/BinanceAPIService.js
const axios = require('axios');
const crypto = require('crypto');
const Bottleneck = require('bottleneck'); // Para Rate Limiting
const CircuitBreaker = require('opossum'); // Para Circuit Breaker
const Logger = require('../utils/Logger');
const { handleCriticalError } = require('../utils/ErrorHandler'); // Importa o ErrorHandler

class BinanceAPIService {
    constructor(config) {
        this.config = config;
        this.logger = new Logger(config); // Passa a configuração para o logger
        this.apiKey = process.env.BINANCE_API_KEY;
        this.apiSecret = process.env.BINANCE_API_SECRET;
        this.baseURL = process.env.BINANCE_BASE_URL || 'https://api.binance.com';

        if (!this.apiKey || !this.apiSecret) {
            const errorMessage = 'As variáveis de ambiente BINANCE_API_KEY ou BINANCE_API_SECRET não estão configuradas.';
            this.logger.error(errorMessage);
            handleCriticalError(new Error(errorMessage), 'Falha na configuração das chaves da API Binance', true);
        }

        this.axiosInstance = axios.create({
            baseURL: this.baseURL,
            timeout: 5000 // Timeout de 5 segundos para requisições
        });

        // Configuração do Rate Limiter para a API REST da Binance
        // Limites de taxa comuns: 1200 requisições/min (peso 1 por req)
        // Cada requisição tem um "peso". Vamos assumir peso 1 por enquanto para simplificar.
        // Para maior precisão, você teria que verificar o peso de cada endpoint.
        this.limiter = new Bottleneck({
            maxConcurrent: 1, // Apenas 1 requisição por vez para garantir a ordem (se necessário)
            minTime: 50 // Garante no máximo 20 requisições por segundo (1000ms / 50ms)
                        // Ajuste este valor com base nos pesos reais da API
        });

        // Configuração do Circuit Breaker
        const options = {
            timeout: 10000, // Se a requisição levar mais de 10s, falha
            errorThresholdPercentage: 50, // Se 50% das requisições falharem, abre o circuito
            resetTimeout: 30000 // Após 30s, tenta fechar o circuito novamente
        };
        this.breaker = new CircuitBreaker(this._makeRequest.bind(this), options);

        this.timeOffset = 0; // Para sincronização de tempo com a Binance
        this.syncTime(); // Sincroniza o tempo na inicialização
        setInterval(() => this.syncTime(), 300000); // Sincroniza a cada 5 minutos
    }

    async syncTime() {
        try {
            const response = await axios.get(`${this.baseURL}/api/v3/time`);
            const serverTime = response.data.serverTime;
            this.timeOffset = serverTime - Date.now();
            this.logger.debug(`Tempo sincronizado com Binance. Offset: ${this.timeOffset}ms`);
        } catch (error) {
            this.logger.error(`Falha ao sincronizar tempo com Binance: ${error.message}`);
            // Não é um erro crítico para encerrar, mas deve ser monitorado
        }
    }

    // Função interna para fazer a requisição, será envolvida pelo Circuit Breaker e Limiter
    async _makeRequest(method, endpoint, params = {}, isSigned = false) {
        const requestConfig = {
            method: method.toLowerCase(),
            url: endpoint,
            data: ['post', 'put', 'delete'].includes(method.toLowerCase()) ? params : undefined,
            params: ['get'].includes(method.toLowerCase()) ? params : undefined,
            headers: {}
        };

        if (isSigned) {
            requestConfig.headers['X-MBX-APIKEY'] = this.apiKey;
            const timestamp = Date.now() + this.timeOffset;
            let queryString = new URLSearchParams({ ...params, timestamp }).toString();
            const signature = crypto.createHmac('sha256', this.apiSecret)
                                    .update(queryString)
                                    .digest('hex');
            queryString += `&signature=${signature}`;

            if (['post', 'put', 'delete'].includes(method.toLowerCase())) {
                requestConfig.data = queryString;
                requestConfig.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            } else {
                requestConfig.url = `${endpoint}?${queryString}`;
            }
        }

        try {
            const response = await this.axiosInstance(requestConfig);
            return response.data;
        } catch (error) {
            // Loga o erro de forma segura, sem expor credenciais
            const status = error.response ? error.response.status : 'N/A';
            const data = error.response ? error.response.data : 'N/A';
            this.logger.error(`Erro na requisição ${method.toUpperCase()} ${endpoint}: Status ${status}, Data: ${JSON.stringify(data)}`, {
                errorName: error.name,
                errorMessage: error.message
            });
            // Relança o erro para que o Circuit Breaker possa agir
            throw error;
        }
    }

    // Métodos públicos para interagir com a API
    async authenticatedRequest(method, endpoint, params = {}) {
        // Usa o limiter e o breaker para todas as requisições autenticadas
        return this.limiter.schedule(() => this.breaker.fire(method, endpoint, params, true));
    }

    async publicRequest(method, endpoint, params = {}) {
        // Usa o limiter, mas não o breaker para requisições públicas, se preferir
        // Ou pode usar o breaker também para todas as requisições, dependendo da necessidade
        return this.limiter.schedule(() => this._makeRequest(method, endpoint, params, false));
    }

    // Métodos específicos da API da Binance
    async getExchangeInfo() {
        // Informações sobre pares de negociação, limites de quantidade/preço
        return this.publicRequest('get', '/api/v3/exchangeInfo');
    }

    async getHistoricalData(symbol, interval, limit = 500) {
        this.logger.debug(`Buscando dados históricos para ${symbol} com intervalo ${interval}...`);
        try {
            // Use publicRequest para dados históricos
            const response = await this.publicRequest('get', '/api/v3/klines', { symbol, interval, limit });
            this.logger.debug(`Dados históricos recebidos para ${symbol}. Total: ${response.length} candles.`);
            return response.map(kline => ({
                openTime: kline[0],
                open: parseFloat(kline[1]),
                high: parseFloat(kline[2]),
                low: parseFloat(kline[3]),
                close: parseFloat(kline[4]),
                volume: parseFloat(kline[5]),
                closeTime: kline[6],
                quoteAssetVolume: parseFloat(kline[7]),
                numberOfTrades: kline[8],
                takerBuyBaseAssetVolume: parseFloat(kline[9]),
                takerBuyQuoteAssetVolume: parseFloat(kline[10]),
                ignore: parseFloat(kline[11])
            }));
        } catch (error) {
            this.logger.error(`Erro ao buscar dados históricos para ${symbol}: ${error.message}`);
            throw error; // Propaga o erro
        }
    }

    async getBalance(asset) {
        this.logger.debug(`Buscando saldo para o ativo: ${asset}`);
        try {
            const accountInfo = await this.authenticatedRequest('get', '/api/v3/account');
            const balance = accountInfo.balances.find(b => b.asset === asset);
            if (!balance) {
                this.logger.warn(`Ativo ${asset} não encontrado na sua conta.`);
                return { free: 0, locked: 0 };
            }
            this.logger.info(`Saldo de ${asset}: Livre=${balance.free}, Bloqueado=${balance.locked}`);
            return { free: parseFloat(balance.free), locked: parseFloat(balance.locked) };
        } catch (error) {
            this.logger.error(`Erro ao buscar saldo para ${asset}: ${error.message}`);
            throw error; // Propaga o erro
        }
    }

    async createOrder(symbol, side, type, quantity, price = null, options = {}) {
        this.logger.info(`Tentando criar ordem: ${side} ${quantity} ${symbol} ${type} @ ${price || 'MARKET'}`);
        const params = {
            symbol,
            side: side.toUpperCase(),
            type: type.toUpperCase(),
            quantity,
            timestamp: Date.now() + this.timeOffset,
            ...options
        };
        if (price) {
            params.price = price;
            params.timeInForce = 'GTC'; // Good Till Cancelled para ordens limit
        }

        try {
            const response = await this.authenticatedRequest('post', '/api/v3/order', params);
            this.logger.trade(`Ordem criada com sucesso:`, response);
            return response;
        } catch (error) {
            this.logger.error(`Falha ao criar ordem para ${symbol} (${side} ${quantity} ${type}): ${error.message}`, {
                binanceErrorCode: error.response?.data?.code,
                binanceErrorMessage: error.response?.data?.msg
            });
            throw error; // Propaga o erro
        }
    }

    // Você pode adicionar mais métodos aqui, como cancelOrder, getOrder, etc.
}

module.exports = BinanceAPIService;