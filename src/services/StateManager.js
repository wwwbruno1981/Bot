// src/services/StateManager.js
const db = require('../db'); // Importa a configuração do banco de dados e modelos
const Logger = require('../utils/Logger');
const { handleCriticalError } = require('../utils/ErrorHandler');

class StateManager {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger || new Logger(config);
        this.botId = 'main_bot_instance'; // ID único para esta instância do bot (pode vir da config)

        // Referência aos modelos do Sequelize
        this.BotStateModel = db.BotState;
        this.TradeModel = db.Trade;

        this.logger.info('StateManager inicializado.');

        // Variável para armazenar a referência ao objeto principal do bot
        // para que possamos atualizar suas propriedades de estado.
        this.botInstance = null;
    }

    /**
     * Conecta ao banco de dados e sincroniza os modelos.
     * Deve ser chamado uma vez na inicialização do bot.
     */
    async connectAndSyncDb() {
        try {
            await db.syncDatabase(false); // `false` para não forçar drop/recriação em produção
            this.logger.info('Conexão e sincronização do DB estabelecidas pelo StateManager.');
        } catch (error) {
            await handleCriticalError(error, 'Falha ao conectar ou sincronizar o banco de dados.');
        }
    }

    /**
     * Carrega o estado salvo do bot do banco de dados e o aplica à instância do bot.
     * @param {object} bot - A instância do BinanceTradingBot para atualizar seu estado.
     */
    async loadState(bot) {
        this.botInstance = bot; // Armazena a referência à instância do bot

        // Garante que o DB está conectado e sincronizado antes de carregar o estado
        await this.connectAndSyncDb();

        try {
            let state = await this.BotStateModel.findOne({ where: { botId: this.botId } });

            if (state) {
                // Aplica o estado carregado às propriedades do bot
                this.botInstance.position.holding = state.holding;
                this.botInstance.position.amount = parseFloat(state.amount);
                this.botInstance.position.asset = state.asset || this.config.strategy.symbol.replace('USDT', '');
                this.botInstance.position.quoteAsset = state.quoteAsset || 'USDT';
                this.botInstance.entryPrice = parseFloat(state.entryPrice);
                this.botInstance.highestPrice = parseFloat(state.highestPrice);
                this.botInstance.lastPrice = parseFloat(state.lastPrice); // Ultimo preço pode ser diferente ao reiniciar, mas o DB guarda o último conhecido.
                this.botInstance.dailyStats = state.dailyStats;
                this.botInstance.accountBalances = state.accountBalances;

                // Resetar dailyStats se for um novo dia
                const now = new Date();
                const lastStartTime = new Date(this.botInstance.dailyStats.startTime);
                if (now.getDate() !== lastStartTime.getDate() || now.getMonth() !== lastStartTime.getMonth() || now.getFullYear() !== lastStartTime.getFullYear()) {
                    this.logger.info('Novo dia detectado. Resetando estatísticas diárias.');
                    // Mover lucro do dia anterior para o histórico de dailyProfits
                    if (this.botInstance.dailyStats.profit !== 0) {
                        this.botInstance.dailyStats.dailyProfits.push({
                            date: lastStartTime.toISOString().split('T')[0],
                            profit: this.botInstance.dailyStats.profit
                        });
                    }
                    this.botInstance.dailyStats.trades = 0;
                    this.botInstance.dailyStats.profit = 0.0;
                    this.botInstance.dailyStats.startTime = now.getTime();
                    await this.saveState(this.botInstance); // Salva o estado resetado imediatamente
                }


                this.logger.info('Estado do bot carregado com sucesso do DB.', {
                    holding: this.botInstance.position.holding,
                    amount: this.botInstance.position.amount,
                    entryPrice: this.botInstance.entryPrice,
                    dailyTrades: this.botInstance.dailyStats.trades,
                    dailyProfit: this.botInstance.dailyStats.profit
                });
            } else {
                this.logger.info('Nenhum estado anterior encontrado no DB. Iniciando com estado padrão.');
                // Garante que o dailyStats tenha um startTime inicial
                this.botInstance.dailyStats.startTime = Date.now();
                // Cria uma entrada inicial no DB
                await this.saveState(this.botInstance);
            }
        } catch (error) {
            await handleCriticalError(error, 'Falha ao carregar estado do bot do banco de dados.');
        }
    }

    /**
     * Salva o estado atual do bot no banco de dados.
     * @param {object} bot - A instância do BinanceTradingBot para obter seu estado.
     */
    async saveState(bot) {
        this.botInstance = bot; // Garante que a referência está atualizada
        try {
            // Prepara os dados para salvar
            const stateData = {
                holding: this.botInstance.position.holding,
                amount: this.botInstance.position.amount,
                asset: this.botInstance.position.asset,
                quoteAsset: this.botInstance.position.quoteAsset,
                entryPrice: this.botInstance.entryPrice,
                highestPrice: this.botInstance.highestPrice,
                lastPrice: this.botInstance.lastPrice,
                dailyStats: this.botInstance.dailyStats,
                accountBalances: this.botInstance.accountBalances,
                updatedAt: new Date()
            };

            // Tenta encontrar e atualizar, ou criar se não existir
            await this.BotStateModel.upsert({
                botId: this.botId,
                ...stateData
            });

            this.logger.debug('Estado do bot salvo no DB.', {
                holding: this.botInstance.position.holding,
                amount: this.botInstance.position.amount,
                dailyTrades: this.botInstance.dailyStats.trades,
                dailyProfit: this.botInstance.dailyStats.profit
            });
        } catch (error) {
            this.logger.error(`Falha ao salvar estado do bot no DB: ${error.message}`);
            // Não é um erro crítico que deva derrubar o bot, mas é importante monitorar
        }
    }

    /**
     * Registra um novo trade no banco de dados.
     * @param {object} tradeDetails - Detalhes do trade para serem salvos.
     * Ex: { symbol, orderId, side, type, quantity, price, profit, reason, timestamp }
     */
    async saveTrade(tradeDetails) {
        try {
            await this.TradeModel.create({
                botId: this.botId,
                ...tradeDetails
            });
            this.logger.trade('Trade registrado no DB.', tradeDetails);
        } catch (error) {
            // Erros de duplicidade no orderId (unique constraint) são comuns em retries, trate-os
            if (error.name === 'SequelizeUniqueConstraintError') {
                this.logger.warn(`Tentativa de registrar trade duplicado (orderId: ${tradeDetails.orderId}).`);
            } else {
                this.logger.error(`Falha ao registrar trade no DB: ${error.message}`, { tradeDetails, errorName: error.name });
            }
        }
    }

    /**
     * Atualiza as estatísticas diárias e salva o estado.
     * @param {object} update - Objeto com as atualizações (ex: { profit: 10, trades: 1 }).
     */
    async updateDailyStats(update) {
        if (!this.botInstance) {
            this.logger.error('botInstance não definido no StateManager. Não é possível atualizar as estatísticas diárias.');
            return;
        }

        if (update.profit) {
            this.botInstance.dailyStats.profit += update.profit;
        }
        if (update.trades) {
            this.botInstance.dailyStats.trades += update.trades;
        }
        // Não salvar o estado imediatamente aqui, o saveState geral já cuidará disso.
        // Esta função apenas atualiza o objeto em memória do bot.
    }

    // Você pode adicionar métodos para buscar histórico de trades, etc.
    async getRecentTrades(limit = 10) {
        try {
            return await this.TradeModel.findAll({
                where: { botId: this.botId },
                order: [['timestamp', 'DESC']],
                limit: limit
            });
        } catch (error) {
            this.logger.error(`Erro ao buscar trades recentes: ${error.message}`);
            return [];
        }
    }
}

module.exports = StateManager;