# 🤖 Bot de Trading Modularizado para Binance

Este projeto é um bot de trading algorítmico desenvolvido em **Node.js**, projetado para operar na **Binance** (Testnet por padrão, configurável para produção). Ele foi completamente **refatorado e modularizado** para garantir uma arquitetura limpa, manutenível e escalável, seguindo princípios de responsabilidade única para cada componente.

---

## 📁 Estrutura do Projeto

```
bot-trading-binance/
├── .env                     # Variáveis de ambiente e configurações sensíveis (NÃO ENVIAR PARA O REPOSITÓRIO)
├── index.js                 # Ponto de entrada principal do aplicativo. Inicializa e gerencia o ciclo de vida do bot.
├── package.json             # Dependências e scripts do projeto
├── package-lock.json
├── logs/                    # Diretório para os arquivos de log gerados pelo bot
└── src/
    ├── config/
    │   └── ConfigManager.js       # Gerencia o carregamento e acesso a todas as configurações do bot (Singleton).
    ├── core/
    │   ├── BinanceTradingBot.js  # O ORQUESTRADOR PRINCIPAL do bot.
    │   ├── RiskManager.js        # Regras de gerenciamento de risco (SL, TP, limites).
    │   ├── SignalProcessor.js    # Lógica de análise técnica e geração de sinais.
    │   └── TradeExecutor.js      # Executa e valida ordens de compra/venda.
    ├── db/
    │   ├── config.js             # Configuração do Sequelize para diferentes ambientes.
    │   ├── index.js              # Inicializa e sincroniza a conexão com o banco.
    │   └── models/
    │       ├── BotState.js       # Representa o estado atual do bot.
    │       └── Trade.js          # Registra o histórico de trades executados.
    ├── services/
    │   ├── BinanceAPIService.js  # Interface com a API REST da Binance (com rate limit e circuit breaker).
    │   ├── TelegramService.js    # Notificações e alertas via Telegram.
    │   ├── WebSocketManager.js   # Dados em tempo real via WebSocket da Binance.
    │   └── StateManager.js       # Salva/recupera o estado do bot no banco.
    └── utils/
        ├── ErrorHandler.js       # Central de tratamento de erros.
        └── Logger.js             # Sistema de logs persistentes e formatados.
```

---

## 🚀 Primeiros Passos e Instalação

### 1. Clone o Repositório

```bash
git clone [https://github.com/wwwbruno1981/Bot.git]
cd bot-trading-binance
```

### 2. Instale as Dependências

```bash
npm install
```

> Isso instalará bibliotecas como `sequelize`, `pg`, `dotenv`, `node-telegram-bot-api`, entre outras.

### 3. Configure o Arquivo `.env`

Crie um arquivo `.env` na raiz do projeto com as seguintes configurações:

```env
# CONFIGURAÇÕES DA API BINANCE
BINANCE_API_KEY=SUA_API_KEY_BINANCE
BINANCE_API_SECRET=SEU_SECRET_KEY_BINANCE
BINANCE_BASE_URL=https://testnet.binance.vision
BINANCE_WS_URL=wss://stream.testnet.binance.vision:9443/ws

# Configurações de Risco
MAX_DAILY_LOSS_PERCENTAGE=0.05
MAX_DAILY_TRADES=5
INITIAL_CAPITAL=1000

# Banco de Dados PostgreSQL
NODE_ENV=development
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bot_trading_db
DB_USER=seu_usuario_postgres
DB_PASS=sua_senha_postgres
DB_LOGGING=false
DB_POOL_MAX=5
DB_POOL_MIN=0
DB_POOL_ACQUIRE=30000
DB_POOL_IDLE=10000
DB_SSL_REQUIRE=false
DB_SSL_REJECT_UNAUTHORIZED=false

# CONFIGURAÇÕES DE TRADING
TRADING_SYMBOL=BTCUSDT
TRADING_QUANTITY=0.001
TRADING_SHORT_PERIOD=7
TRADING_LONG_PERIOD=21
TRADING_USE_EMA=true
TRADING_MIN_PROFIT=0.5

# GERENCIAMENTO DE RISCO
RISK_STOP_LOSS=-2.0
RISK_TAKE_PROFIT=3.0
RISK_TRAILING_STOP=true
RISK_TRAILING_STOP_PERCENT=1.5
RISK_MAX_POSITIONS=1
RISK_MAX_DAILY_LOSS=-5.0
RISK_MAX_DAILY_TRADES=10

# NOTIFICAÇÕES TELEGRAM
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=SEU_BOT_TOKEN_TELEGRAM
TELEGRAM_CHAT_ID=SEU_CHAT_ID_TELEGRAM

# CONFIGURAÇÕES DE LOG
LOG_LEVEL=info
LOG_SAVE_TO_FILE=true
LOG_MAX_FILE_SIZE=10
LOG_DIRECTORY=./logs

# AVANÇADO
MAX_RECONNECT_ATTEMPTS=10
HEARTBEAT_INTERVAL=30000
STATUS_DISPLAY_INTERVAL=60000
PRICE_PRECISION=8
QUANTITY_PRECISION=6

# MODO DEBUG
DEBUG=false
SIMULATE_TRADING=false
```

---

### 4. Crie o Banco de Dados PostgreSQL

O Sequelize criará as tabelas, mas é necessário criar o banco uma vez:

#### Via terminal (psql)

```bash
psql -U seu_usuario_postgres -c "CREATE DATABASE bot_trading_db;"
```

#### Via ferramenta gráfica (pgAdmin, DBeaver)

Crie um banco com o nome definido na variável `DB_NAME`.

---

## ▶️ Como Rodar o Bot

Execute o bot com o comando:

```bash
node index.js
```

Para encerrar o bot com segurança, pressione `Ctrl + C` para ativar o desligamento gracioso.

---

## 📊 Monitoramento

- **Logs**: consulte a pasta `logs/` para registros detalhados da execução.
- **Telegram**: notificações automáticas, se habilitado no `.env`.
- **Banco de Dados**: acompanhe as tabelas `bot_states` e `trades` para estado e histórico.

---

## 🛠️ Expansões Futuras

Você pode adicionar novas estratégias, integração com dashboards ou suporte a múltiplos pares. Estrutura modular facilita extensões como:

- Backtesting
- Interface Web em React.js
- App mobile com React Native
- Estratégias alternativas com IA ou redes neurais
- Deploy via Docker ou nuvem

---

## 📌 Avisos

- Este projeto está conectado por padrão à **Binance Testnet**.
- Nunca envie seu `.env` para repositórios públicos.
- Use `SIMULATE_TRADING=true` para rodar sem executar ordens reais.

---

## 📬 Contato

Sinta-se à vontade para abrir issues ou pull requests com melhorias ou correções!

---

> Projeto desenvolvido com foco em estudo, aprendizado e automatização de operações financeiras. Use com responsabilidade.