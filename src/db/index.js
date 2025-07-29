// src/db/index.js
const { Sequelize, DataTypes } = require('sequelize');
const config = require('./config')[process.env.NODE_ENV || 'development']; // Carrega config de dev ou prod

//console.log('DEBUG: Configurações do DB sendo usadas:', config); // Adicione esta linha
//console.log('DEBUG: Dialeto do DB:', config.dialect); // Adicione esta linha


const sequelize = new Sequelize(config.database, config.username, config.password, {
    host: config.host,
    port: config.port,
    dialect: config.dialect, // <--- ESTA LINHA É CRUCIAL
    logging: config.logging,
    dialectOptions: config.dialectOptions,
    pool: config.pool
});

const db = {};

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Carrega os modelos
db.BotState = require('./models/BotState')(sequelize, DataTypes);
db.Trade = require('./models/Trade')(sequelize, DataTypes);

// Defina associações se houver (ex: um trade pertence a um período de estado do bot)
// Exemplo:
// db.BotState.hasMany(db.Trade, { foreignKey: 'botStateId' });
// db.Trade.belongsTo(db.BotState, { foreignKey: 'botStateId' });

/**
 * Sincroniza os modelos com o banco de dados.
 * Cria as tabelas se elas não existirem.
 * @param {boolean} force - Se true, irá dropar tabelas existentes e recriá-las. USE COM CAUTELA EM PRODUÇÃO!
 */
db.syncDatabase = async (force = false) => {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexão com o banco de dados estabelecida com sucesso.');
        await sequelize.sync({ force: force });
        console.log('✅ Tabelas sincronizadas com o banco de dados.');
    } catch (error) {
        console.error('❌ Não foi possível conectar ao banco de dados ou sincronizar tabelas:', error);
        throw error; // Propaga o erro para o ErrorHandler principal
    }
};

module.exports = db;