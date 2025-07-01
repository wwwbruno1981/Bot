require('dotenv').config();

console.log('🔍 DEBUG - Variáveis de ambiente:');
console.log('API_KEY:', process.env.BINANCE_API_KEY ? 'Configurada ✅' : 'Não encontrada ❌');
console.log('API_SECRET:', process.env.BINANCE_API_SECRET ? 'Configurada ✅' : 'Não encontrada ❌');
console.log('BASE_URL:', process.env.BINANCE_BASE_URL || 'Não encontrada ❌');
console.log('WS_URL:', process.env.BINANCE_WS_URL || 'Não encontrada ❌');
console.log('---');

// Importa e executa o bot da pasta src
const BotClass = require('./src/bot');

// Inicia o bot
console.log('🤖 Iniciando bot...');

// Verifica se é uma classe/constructor e instancia corretamente
if (typeof BotClass === 'function') {
    try {
        // Tenta instanciar como classe
        const botInstance = new BotClass();
        
        // Depois tenta chamar métodos de inicialização
        if (typeof botInstance.start === 'function') {
            botInstance.start();
        } else if (typeof botInstance.init === 'function') {
            botInstance.init();
        } else {
            console.log('✅ Bot instanciado com sucesso!');
        }
    } catch (error) {
        // Se falhar como classe, tenta como função normal
        try {
            BotClass();
        } catch (e) {
            console.error('❌ Erro ao inicializar bot:', e.message);
        }
    }
} else if (BotClass && typeof BotClass.start === 'function') {
    BotClass.start();
} else if (BotClass && typeof BotClass.init === 'function') {
    BotClass.init();
} else {
    console.log('✅ Bot carregado com sucesso!');
}