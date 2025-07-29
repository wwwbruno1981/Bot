// src/services/TelegramService.js
const TelegramBot = require('node-telegram-bot-api');
const Logger = require('../utils/Logger');

class TelegramService {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger || new Logger(config);

        this.botToken = this.config.telegram.botToken;
        this.chatId = this.config.telegram.chatId;
        this.enabled = this.config.telegram.enabled;

        this.bot = null; // Instância do bot do Telegram

        if (this.enabled) {
            if (!this.botToken || !this.chatId) {
                this.logger.error('Telegram habilitado, mas BOT_TOKEN ou CHAT_ID não configurados nas variáveis de ambiente. As notificações por Telegram não funcionarão.');
                this.enabled = false; // Desabilita o serviço se as credenciais estiverem faltando
            } else {
                try {
                    // 'polling' é para receber atualizações, 'none' é apenas para enviar mensagens.
                    // Usamos 'none' pois o bot de trading geralmente só envia notificações.
                    this.bot = new TelegramBot(this.botToken, { polling: false });
                    this.logger.info('TelegramService inicializado e conectado à API do Telegram.');
                    // Opcional: Testar o envio de uma mensagem de inicialização
                    // this.sendTelegramNotification('TelegramService iniciado com sucesso!');
                } catch (error) {
                    this.logger.error(`Erro ao inicializar TelegramService: ${error.message}. As notificações por Telegram não funcionarão.`);
                    this.enabled = false;
                }
            }
        } else {
            this.logger.info('TelegramService desabilitado por configuração.');
        }
    }

    /**
     * Envia uma mensagem para o chat do Telegram configurado.
     * @param {string} message - A mensagem a ser enviada.
     * @returns {Promise<boolean>} True se a mensagem foi enviada com sucesso, false caso contrário.
     */
    async sendTelegramNotification(message) {
        if (!this.enabled || !this.bot) {
            this.logger.debug('TelegramService não habilitado ou não inicializado. Notificação não enviada.');
            return false;
        }

        try {
            // Parse_mode 'MarkdownV2' ou 'HTML' para formatação avançada.
            // Certifique-se de escapar caracteres especiais se usar MarkdownV2.
            await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' }); // Ou 'MarkdownV2', 'HTML'
            this.logger.debug('Notificação Telegram enviada com sucesso.');
            return true;
        } catch (error) {
            this.logger.error(`Falha ao enviar notificação Telegram: ${error.message}`);
            // Erros comuns: chat_id inválido, token inválido, bot bloqueado.
            // Não é um erro crítico para derrubar o bot, mas é importante monitorar.
            return false;
        }
    }

    /**
     * Retorna se o serviço Telegram está habilitado.
     * @returns {boolean} True se habilitado, false caso contrário.
     */
    isEnabled() {
        return this.enabled;
    }
}

module.exports = TelegramService;