// src/db/config.js
// Podemos remover require('dotenv').config() daqui se já estiver em index.js para carregamento global.
// No entanto, mantê-lo aqui como uma salvaguarda para testes diretos do módulo não é prejudicial.
// Vamos mantê-lo por enquanto para segurança, mas saiba que seu carregamento principal é do index.js.
require('dotenv').config();

const commonConfig = {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: process.env.DB_DIALECT,
    logging: process.env.DB_LOGGING === 'true' || false, // Use uma var .env para logging ou padrão para false
    pool: {
        max: parseInt(process.env.DB_POOL_MAX || '5', 10),
        min: parseInt(process.env.DB_POOL_MIN || '0', 10),
        acquire: parseInt(process.env.DB_POOL_ACQUIRE || '30000', 10),
        idle: parseInt(process.env.DB_POOL_IDLE || '10000', 10)
    }
};

module.exports = {
    development: {
        ...commonConfig,
        dialectOptions: {
            // SSL geralmente não é necessário para desenvolvimento local
        }
    },
    production: {
        ...commonConfig,
        pool: { // O pool de produção pode ser maior
            max: parseInt(process.env.DB_PROD_POOL_MAX || '10', 10),
            min: parseInt(process.env.DB_PROD_POOL_MIN || '2', 10),
            acquire: parseInt(process.env.DB_PROD_POOL_ACQUIRE || '60000', 10),
            idle: parseInt(process.env.DB_PROD_POOL_IDLE || '30000', 10)
        },
        dialectOptions: {
            ssl: {
                require: process.env.DB_SSL_REQUIRE === 'true',
                rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' // Geralmente false para certificados autoassinados ou sem CA
            }
        }
    }
};