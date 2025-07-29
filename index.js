// index.js
require('dotenv').config(); // Carrega as variáveis de ambiente do .env
const BinanceTradingBot = require('./src/core/BinanceTradingBot');
const { handleCriticalError } = require('./src/utils/ErrorHandler'); // Para capturar erros não tratados

let bot; // Variável para a instância do bot

const startBot = async () => {
    try {
        console.log('Iniciando o bot de trading...');
        bot = new BinanceTradingBot();
        await bot.init();
        console.log('Bot de trading iniciado com sucesso!');
    } catch (error) {
        await handleCriticalError(error, 'Erro fatal durante a inicialização do bot.');
        process.exit(1); // Sai do processo com código de erro
    }
};

const stopBot = async () => {
    if (bot) {
        console.log('Desligando o bot de trading...');
        await bot.stop();
        console.log('Bot de trading desligado com sucesso!');
    }
    process.exit(0); // Sai do processo normalmente
};

// Inicia o bot
startBot();

// Lida com o desligamento gracioso do bot em caso de sinais de interrupção
process.on('SIGINT', stopBot);  // Ctrl+C
process.on('SIGTERM', stopBot); // Sinal de término (usado por gerenciadores de processos como PM2)
process.on('uncaughtException', async (error) => {
    await handleCriticalError(error, 'Exceção não capturada! O bot será desligado.');
    stopBot(); // Tenta desligar o bot graciosamente
});
process.on('unhandledRejection', async (reason, promise) => {
    await handleCriticalError(new Error(`Rejeição de Promise não tratada: ${reason}`), 'Rejeição de Promise não tratada! O bot será desligado.');
    stopBot(); // Tenta desligar o bot graciosamente
});