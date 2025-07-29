// src/utils/ErrorHandler.js
const Logger = require('./Logger'); // Assume que Logger é importável
let telegramServiceInstance = null; // Será injetado na inicialização

/**
 * Inicializa o ErrorHandler injetando a instância do TelegramService.
 * Deve ser chamado uma vez na inicialização do BinanceTradingBot.
 * @param {object} telegramService - A instância do TelegramService.
 */
function initializeErrorHandler(telegramService) {
    telegramServiceInstance = telegramService;
}

/**
 * Lida com erros críticos, logando-os e potencialmente enviando notificações e encerrando o processo.
 * @param {Error} error - O objeto de erro.
 * @param {string} context - Um contexto descritivo para o erro (ex: "Erro ao conectar WebSocket").
 * @param {boolean} shouldExit - Se o processo deve ser encerrado após o erro. Padrão: true.
 */
async function handleCriticalError(error, context = 'Erro desconhecido', shouldExit = true) {
    // Use uma instância de Logger (pode ser a mesma do bot ou uma nova, dependendo da sua estratégia)
    const logger = new Logger(require('../config/ConfigManager').getInstance().getConfig()); // Obtém a config do singleton ConfigManager

    logger.error(`${context}: ${error.message || error}`, { 
        stack: error.stack ? error.stack.split('\n') : 'No stack trace', // Dividir stack para melhor leitura em JSON
        context,
        errorName: error.name,
        errorMessage: error.message
    });

    if (telegramServiceInstance && telegramServiceInstance.config.notifications.telegram.enabled) {
        try {
            // Formata a mensagem para o Telegram
            let telegramMessage = `❗ *Alerta de Erro Crítico no Bot*\n\n`;
            telegramMessage += `*Contexto:* ${context}\n`;
            telegramMessage += `*Mensagem:* \`\`\`${error.message || error}\`\`\`\n`;
            if (error.code) telegramMessage += `*Código:* ${error.code}\n`; // Adicionar código de erro se existir

            await telegramServiceInstance.sendTelegramNotification(telegramMessage);
        } catch (telegramError) {
            logger.error(`Falha ao enviar notificação de erro crítico para o Telegram: ${telegramError.message}`);
        }
    }

    if (shouldExit) {
        logger.error(`Encerrando o processo devido ao erro crítico em: ${context}`);
        process.exit(1); // Encerra o processo
    }
}

module.exports = {
    handleCriticalError,
    initializeErrorHandler,
};