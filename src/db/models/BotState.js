// src/db/models/BotState.js
module.exports = (sequelize, DataTypes) => {
    const BotState = sequelize.define('BotState', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        // Identificador do bot, útil se você rodar múltiplas instâncias
        botId: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true, // Garante que há apenas um estado por botId
            defaultValue: 'main_bot_instance' // Valor padrão se não for especificado
        },
        // Estado da posição
        holding: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        amount: {
            type: DataTypes.DECIMAL(20, 10), // Precisão para quantidades
            defaultValue: 0.0,
        },
        asset: {
            type: DataTypes.STRING, // Ex: BTC
            allowNull: true,
        },
        quoteAsset: {
            type: DataTypes.STRING, // Ex: USDT
            allowNull: true,
        },
        entryPrice: {
            type: DataTypes.DECIMAL(20, 10), // Precisão para preços
            defaultValue: 0.0,
        },
        highestPrice: {
            type: DataTypes.DECIMAL(20, 10),
            defaultValue: 0.0,
        },
        lastPrice: {
            type: DataTypes.DECIMAL(20, 10),
            defaultValue: 0.0,
        },
        // Estatísticas diárias
        dailyStats: {
            type: DataTypes.JSONB, // Armazena como JSON no DB
            defaultValue: {
                trades: 0,
                profit: 0.0,
                startTime: 0, // Timestamp
                dailyProfits: [] // Histórico de lucros diários
            },
        },
        // Balanços da conta (pode ser útil persistir)
        accountBalances: {
            type: DataTypes.JSONB,
            defaultValue: {},
        },
        // Outras informações que você queira persistir globalmente
        // Ex: symbolInfo, se for muito grande e não mudar com frequência
        // symbolInfo: {
        //     type: DataTypes.JSONB,
        //     allowNull: true,
        // },
        // Timestamp da última atualização
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    }, {
        tableName: 'bot_state', // Nome da tabela no banco
        timestamps: true, // Adiciona createdAt e updatedAt automaticamente
        // hooks: { // Exemplo de hook para atualizar `updatedAt` manualmente se necessário
        //     beforeUpdate: (instance, options) => {
        //         instance.updatedAt = new Date();
        //     }
        // }
    });

    return BotState;
};