const winston = require('winston');
const chalk = require('chalk');
const moment = require('moment');
const fs = require('fs');
const path = require('path');

class Logger {
    constructor(config) {
        this.config = config.logging;
        this.logDir = path.resolve(this.config.directory);
        this.createLogDirectory();
        this.setupWinston();
    }

    createLogDirectory() {
        if (this.config.saveToFile && !fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    setupWinston() {
        const transports = [];

        // Console transport com cores
        transports.push(
            new winston.transports.Console({
                level: this.config.level,
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.printf(({ timestamp, level, message, ...meta }) => {
                        return this.formatConsoleMessage(timestamp, level, message, meta);
                    })
                )
            })
        );

        // File transport se habilitado
        if (this.config.saveToFile) {
            transports.push(
                new winston.transports.File({
                    filename: path.join(this.logDir, 'trading-bot.log'),
                    level: this.config.level,
                    maxsize: this.config.maxFileSize * 1024 * 1024,
                    maxFiles: 5,
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json()
                    )
                })
            );

            // Log de erros separado
            transports.push(
                new winston.transports.File({
                    filename: path.join(this.logDir, 'error.log'),
                    level: 'error',
                    maxsize: this.config.maxFileSize * 1024 * 1024,
                    maxFiles: 3,
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json()
                    )
                })
            );
        }

        this.logger = winston.createLogger({
            level: this.config.level,
            transports: transports,
            exitOnError: false
        });
    }

    formatConsoleMessage(timestamp, level, message, meta) {
        const time = moment(timestamp).format('HH:mm:ss');
        const levelColor = this.getLevelColor(level);
        const icon = this.getLevelIcon(level);
        
        let formattedMessage = `${chalk.gray(time)} ${levelColor(`[${level.toUpperCase()}]`)} ${icon} ${message}`;
        
        if (Object.keys(meta).length > 0) {
            formattedMessage += `\n${chalk.gray(JSON.stringify(meta, null, 2))}`;
        }
        
        return formattedMessage;
    }

    getLevelColor(level) {
        const colors = {
            error: chalk.red,
            warn: chalk.yellow,
            info: chalk.blue,
            debug: chalk.green
        };
        return colors[level] || chalk.white;
    }

    getLevelIcon(level) {
        const icons = {
            error: '❌',
            warn: '⚠️',
            info: 'ℹ️',
            debug: '🔍'
        };
        return icons[level] || '📝';
    }

    // Métodos de logging
    error(message, meta = {}) {
        this.logger.error(message, meta);
    }

    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }

    // Logs específicos para trading
    trade(action, details) {
        const message = `${action.toUpperCase()} - ${details.symbol} - Quantidade: ${details.quantity} - Preço: $${details.price}`;
        this.info(message, { 
            type: 'TRADE', 
            action, 
            ...details,
            timestamp: moment().toISOString()
        });
    }

    signal(type, details) {
        const message = `Sinal ${type} detectado - ${details.symbol} - Preço: $${details.price}`;
        this.info(message, { 
            type: 'SIGNAL', 
            signal: type,
            ...details,
            timestamp: moment().toISOString()
        });
    }

    profit(details) {
        const profitColor = details.profit >= 0 ? chalk.green : chalk.red;
        const message = `P&L: ${profitColor(details.profit.toFixed(2))}% - Entrada: $${details.entryPrice} - Saída: $${details.exitPrice}`;
        this.info(message, { 
            type: 'PROFIT', 
            ...details,
            timestamp: moment().toISOString()
        });
    }

    balance(balances) {
        const message = `Saldo atualizado: ${Object.entries(balances).map(([asset, amount]) => `${asset}: ${amount}`).join(' | ')}`;
        this.info(message, { 
            type: 'BALANCE', 
            balances,
            timestamp: moment().toISOString()
        });
    }

    // Log de status com formatação especial
    status(status) {
        console.log(chalk.cyan('\n=== STATUS DO BOT ==='));
        console.log(chalk.white(`Símbolo: ${chalk.yellow(status.symbol)}`));
        console.log(chalk.white(`Preço atual: ${chalk.green('$' + status.currentPrice)}`));
        console.log(chalk.white(`EMA/SMA ${status.shortPeriod}: ${chalk.blue('$' + (status.shortMA || 'N/A'))}`));
        console.log(chalk.white(`EMA/SMA ${status.longPeriod}: ${chalk.blue('$' + (status.longMA || 'N/A'))}`));
        console.log(chalk.white(`Posição: ${status.position ? chalk.green(status.position) : chalk.gray('Nenhuma')}`));
        
        if (status.position && status.entryPrice > 0) {
            const profitColor = status.profit >= 0 ? chalk.green : chalk.red;
            console.log(chalk.white(`Preço de entrada: ${chalk.yellow('$' + status.entryPrice)}`));
            console.log(chalk.white(`P&L: ${profitColor(status.profit.toFixed(2) + '%')}`));
            
            if (status.trailingStop) {
                console.log(chalk.white(`Maior preço: ${chalk.cyan('$' + status.highestPrice)}`));
                console.log(chalk.white(`Trailing Stop: ${chalk.red('$' + status.trailingStopPrice.toFixed(2))}`));
            }
        }
        
        console.log(chalk.cyan('====================\n'));
    }

    // Log de inicialização
    startup(config) {
        console.log(chalk.green.bold('\n🤖 TRADING BOT INICIADO\n'));
        console.log(chalk.white(`📊 Símbolo: ${chalk.yellow(config.trading.symbol)}`));
        console.log(chalk.white(`📈 Estratégia: ${chalk.blue(config.trading.useEMA ? 'EMA' : 'SMA')} (${config.trading.shortPeriod}/${config.trading.longPeriod})`));
        console.log(chalk.white(`💰 Quantidade: ${chalk.green(config.trading.quantity)}`));
        console.log(chalk.white(`🛡️ Stop Loss: ${chalk.red(config.riskManagement.stopLoss + '%')}`));
        console.log(chalk.white(`🎯 Take Profit: ${chalk.green('+' + config.riskManagement.takeProfit + '%')}`));
        
        if (config.riskManagement.trailingStop) {
            console.log(chalk.white(`📉 Trailing Stop: ${chalk.cyan(config.riskManagement.trailingStopPercent + '%')}`));
        }
        
        if (config.development.simulateTrading) {
            console.log(chalk.yellow.bold('\n⚠️  MODO SIMULAÇÃO ATIVADO - NENHUMA ORDEM REAL SERÁ EXECUTADA\n'));
        }
        
        console.log(chalk.gray('=' * 50 + '\n'));
    }

    // Cleanup dos logs antigos
    cleanup() {
        if (!this.config.saveToFile) return;

        try {
            const files = fs.readdirSync(this.logDir);
            const logFiles = files.filter(file => file.endsWith('.log'));
            
            logFiles.forEach(file => {
                const filePath = path.join(this.logDir, file);
                const stats = fs.statSync(filePath);
                const fileAge = Date.now() - stats.mtime.getTime();
                const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 dias
                
                if (fileAge > maxAge) {
                    fs.unlinkSync(filePath);
                    this.info(`Log antigo removido: ${file}`);
                }
            });
        } catch (error) {
            this.error('Erro na limpeza de logs:', { error: error.message });
        }
    }
}

module.exports = Logger;