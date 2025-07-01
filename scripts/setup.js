#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🚀 Configuração do Bot de Trading BTC\n');

async function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function setup() {
    try {
        // Verificar se .env já existe
        if (fs.existsSync('.env')) {
            const overwrite = await question('Arquivo .env já existe. Deseja sobrescrever? (y/N): ');
            if (overwrite.toLowerCase() !== 'y') {
                console.log('Setup cancelado.');
                process.exit(0);
            }
        }

        console.log('\n=== CONFIGURAÇÕES DA API BINANCE ===');
        const apiKey = await question('API Key da Binance: ');
        const apiSecret = await question('API Secret da Binance: ');

        console.log('\n=== CONFIGURAÇÕES DE TRADING ===');
        const symbol = await question('Símbolo (padrão: BTCUSDT): ') || 'BTCUSDT';
        const quantity = await question('Quantidade por trade (padrão: 0.001): ') || '0.001';
        const shortPeriod = await question('Período da média móvel curta (padrão: 7): ') || '7';
        const longPeriod = await question('Período da média móvel longa (padrão: 21): ') || '21';
        const useEMA = await question('Usar EMA em vez de SMA? (Y/n): ');

        console.log('\n=== GERENCIAMENTO DE RISCO ===');
        const stopLoss = await question('Stop Loss em % (padrão: -2.0): ') || '-2.0';
        const takeProfit = await question('Take Profit em % (padrão: 3.0): ') || '3.0';
        const trailingStop = await question('Ativar Trailing Stop? (Y/n): ');
        const trailingStopPercent = await question('Trailing Stop % (padrão: 1.5): ') || '1.5';

        console.log('\n=== NOTIFICAÇÕES TELEGRAM (OPCIONAL) ===');
        const telegramEnabled = await question('Ativar notificações Telegram? (y/N): ');
        let telegramBotToken = '';
        let telegramChatId = '';

        if (telegramEnabled.toLowerCase() === 'y') {
            telegramBotToken = await question('Bot Token do Telegram: ');
            telegramChatId = await question('Chat ID do Telegram: ');
        }

        console.log('\n=== CONFIGURAÇÕES AVANÇADAS ===');
        const logLevel = await question('Nível de log (debug/info/warn/error - padrão: info): ') || 'info';
        const simulateTrading = await question('Modo simulação (sem trades reais)? (y/N): ');

        // Criar conteúdo do .env
        const envContent = `# ===========================================
# CONFIGURAÇÕES DA API BINANCE
# ===========================================
BINANCE_API_KEY=${apiKey}
BINANCE_API_SECRET=${apiSecret}
BINANCE_BASE_URL=https://api.binance.com
BINANCE_WS_URL=wss://stream.binance.com:9443/ws

# ===========================================
# CONFIGURAÇÕES DE TRADING
# ===========================================
TRADING_SYMBOL=${symbol}
TRADING_QUANTITY=${quantity}
TRADING_SHORT_PERIOD=${shortPeriod}
TRADING_LONG_PERIOD=${longPeriod}
TRADING_USE_EMA=${useEMA.toLowerCase() !== 'n'}
TRADING_MIN_PROFIT=0.5

# ===========================================
# GERENCIAMENTO DE RISCO
# ===========================================
RISK_STOP_LOSS=${stopLoss}
RISK_TAKE_PROFIT=${takeProfit}
RISK_TRAILING_STOP=${trailingStop.toLowerCase() !== 'n'}
RISK_TRAILING_STOP_PERCENT=${trailingStopPercent}
RISK_MAX_POSITIONS=1
RISK_MAX_DAILY_LOSS=-5.0
RISK_MAX_DAILY_TRADES=10

# ===========================================
# NOTIFICAÇÕES TELEGRAM
# ===========================================
TELEGRAM_ENABLED=${telegramEnabled.toLowerCase() === 'y'}
TELEGRAM_BOT_TOKEN=${telegramBotToken}
TELEGRAM_CHAT_ID=${telegramChatId}

# ===========================================
# CONFIGURAÇÕES DE LOG
# ===========================================
LOG_LEVEL=${logLevel}
LOG_SAVE_TO_FILE=true
LOG_MAX_FILE_SIZE=10
LOG_DIRECTORY=./logs

# ===========================================
# CONFIGURAÇÕES AVANÇADAS
# ===========================================
MAX_RECONNECT_ATTEMPTS=10
HEARTBEAT_INTERVAL=30000
STATUS_DISPLAY_INTERVAL=60000
PRICE_PRECISION=8
QUANTITY_PRECISION=6

# ===========================================
# MODO DE DESENVOLVIMENTO
# ===========================================
NODE_ENV=production
DEBUG=false
SIMULATE_TRADING=${simulateTrading.toLowerCase() === 'y'}`;

        // Salvar arquivo .env
        fs.writeFileSync('.env', envContent);

        // Criar diretórios necessários
        const dirs = ['logs', 'src/config', 'src/utils', 'scripts', 'tests'];
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        console.log('\n✅ Configuração concluída com sucesso!');
        console.log('\n📁 Arquivos criados:');
        console.log('   - .env (configurações)');
        console.log('   - logs/ (diretório de logs)');
        
        console.log('\n🚀 Para iniciar o bot:');
        console.log('   npm start');
        
        console.log('\n🎮 Para modo simulação:');
        console.log('   npm run simulate');
        
        console.log('\n📊 Para ver logs em tempo real:');
        console.log('   npm run logs');

        if (simulateTrading.toLowerCase() === 'y') {
            console.log('\n⚠️  MODO SIMULAÇÃO ATIVADO - Nenhuma ordem real será executada');
        }

        console.log('\n⚠️  IMPORTANTE:');
        console.log('   - Certifique-se de que suas credenciais da Binance estão corretas');
        console.log('   - Teste primeiro em modo simulação');
        console.log('   - Use apenas valores que você pode perder');
        console.log('   - Monitore o bot regularmente');

    } catch (error) {
        console.error('\n❌ Erro durante a configuração:', error.message);
        process.exit(1);
    } finally {
        rl.close();
    }
}

// Executar setup
setup();