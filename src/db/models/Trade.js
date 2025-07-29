// src/db/models/Trade.js
module.exports = (sequelize, DataTypes) => {
    const Trade = sequelize.define('Trade', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        botId: {
            type: DataTypes.STRING, // Para associar a uma instância específica do bot
            allowNull: false,
            defaultValue: 'main_bot_instance'
        },
        orderId: {
            type: DataTypes.STRING, // ID da ordem na Binance
            allowNull: false,
            unique: true, // IDs de ordem são únicos
        },
        symbol: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        side: {
            type: DataTypes.ENUM('BUY', 'SELL'), // Compra ou Venda
            allowNull: false,
        },
        type: {
            type: DataTypes.STRING, // MARKET, LIMIT, etc.
            allowNull: false,
        },
        quantity: {
            type: DataTypes.DECIMAL(20, 10),
            allowNull: false,
        },
        price: {
            type: DataTypes.DECIMAL(20, 10), // Preço médio de execução
            allowNull: false,
        },
        quoteAmount: { // Quantidade total na moeda de cotação (ex: USDT)
            type: DataTypes.DECIMAL(20, 10),
            allowNull: true, // Pode ser null para ordens de compra antes da execução total
        },
        profit: { // Lucro/prejuízo do trade (apenas para vendas)
            type: DataTypes.DECIMAL(20, 10),
            defaultValue: 0.0,
        },
        reason: { // Motivo do trade (SIGNAL_BUY, STOP_LOSS, TAKE_PROFIT, TRAILING_STOP, etc.)
            type: DataTypes.STRING,
            allowNull: true,
        },
        timestamp: {
            type: DataTypes.BIGINT, // Timestamp da execução da ordem
            allowNull: false,
        },
        // Metadados adicionais, se necessário
        meta: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    }, {
        tableName: 'trades', // Nome da tabela no banco
        timestamps: true, // Adiciona createdAt e updatedAt automaticamente
        updatedAt: false, // Trades geralmente não são "atualizados", apenas criados
    });

    return Trade;
};