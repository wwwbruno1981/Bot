const fs = require('fs');
const path = require('path');
const moment = require('moment'); // Já está no seu bot.js, então vamos usá-lo

class Logger {
    constructor(config) {
        this.config = config || {}; // Garante que config está definido
        this.logLevel = this.config.log?.logLevel || 'info';
        this.logSaveToFile = this.config.log?.logSaveToFile || false;
        this.logDirectory = this.config.log?.logDirectory || './logs';
        this.maxFileSize = (this.config.log?.maxFileSize || 10) * 1024 * 1024; // MB para bytes
        this.logFilePath = path.join(this.logDirectory, `bot_log_${moment().format('YYYY-MM-DD')}.json`);

        this.ensureLogDirectoryExists();
        this.rotateLogFile(); // Implementar rotação de log
    }

    ensureLogDirectoryExists() {
        if (!fs.existsSync(this.logDirectory)) {
            fs.mkdirSync(this.logDirectory, { recursive: true });
        }
    }

    rotateLogFile() {
        // Implementação simples de rotação de log por tamanho
        if (fs.existsSync(this.logFilePath)) {
            const stats = fs.statSync(this.logFilePath);
            if (stats.size > this.maxFileSize) {
                const oldPath = this.logFilePath;
                const newPath = path.join(this.logDirectory, `bot_log_${moment().subtract(1, 'day').format('YYYY-MM-DD_HH-mm-ss')}.json`);
                fs.renameSync(oldPath, newPath);
                console.warn(`Arquivo de log ${oldPath} renomeado para ${newPath} devido ao tamanho.`);
                this.logFilePath = path.join(this.logDirectory, `bot_log_${moment().format('YYYY-MM-DD')}.json`);
            }
        }
    }

    shouldLog(level) {
        const levels = {
            'debug': 0,
            'info': 1,
            'status': 2, // Novo nível para status
            'trade': 3,  // Novo nível para trades
            'signal': 4, // Novo nível para sinais
            'balance': 5, // Novo nível para balanços
            'warn': 6,
            'error': 7
        };
        return levels[level] >= levels[this.logLevel];
    }

    log(level, message, metadata = {}) {
        if (!this.shouldLog(level)) {
            return;
        }

        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...metadata
        };

        const logString = JSON.stringify(logEntry);

        if (this.logSaveToFile) {
            try {
                fs.appendFileSync(this.logFilePath, logString + '\n');
            } catch (err) {
                console.error(`Erro ao escrever no arquivo de log ${this.logFilePath}: ${err.message}`);
                // Fallback para console se não puder escrever no arquivo
                console.log(logString);
            }
        } else {
            console.log(logString);
        }
    }

    debug(message, metadata) { this.log('debug', message, metadata); }
    info(message, metadata) { this.log('info', message, metadata); }
    warn(message, metadata) { this.log('warn', message, metadata); }
    error(message, metadata) { this.log('error', message, metadata); }

    // Níveis de log específicos para o bot de trading
    trade(message, metadata) { this.log('trade', message, metadata); }
    balance(message, metadata) { this.log('balance', message, metadata); }
    status(message, metadata) { this.log('status', message, metadata); }
    signal(message, metadata) { this.log('signal', message, metadata); }
}

module.exports = Logger;