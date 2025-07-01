🤖 Bot de Trading BTC Avançado

✅ Principais funções para modularização:

    Requisições autenticadas / assinatura
    Médias móveis (SMA/EMA)
    Controle de risco diário
    Gerenciamento de ordens (compra e venda)
    Condições de saída
    Processamento de novo preço
    WebSocket e reconexão
    Logger e notificações
    Inicialização e parada

📋 Funcionalidades

✅ NOTIFICAÇÕES TELEGRAM
✅ Executa Trading na Binance (ex: Binance testenet)
✅ Monitora o mercado com o uso de API (ex: monitora o preço do BTCUSDT)
✅ Cria histórico de Operações (ex: banco de dados para salvar dados do usuário)
🚧 Conexão com Dashboard (Funcionalidade em desenvolvimento)

🛠️ Tecnologias Utilizadas

Node.js - Runtime JavaScript
React.js (Para o Dashboard)
Express.js - Framework web (se aplicável)
PostgreSQL/MongoDB - Banco de dados (em implatação)
dotenv - Gerenciamento de variáveis de ambiente

🚀 Como executar o projeto
Pré-requisitos

Node.js (versão 16 ou superior)
npm ou yarn

Instalação

Clone o repositório:

bashgit clone https://github.com/wwwwbruno1981/bot
cd nome-do-bot

Instale as dependências:

bashnpm install

Configure as variáveis de ambiente:

bashcp .env.example .env
Edite o arquivo .env com suas configurações.

Execute o projeto:

bash# Desenvolvimento
npm run dev

# Produção
npm start
⚙️ Configuração
Variáveis de Ambiente
Crie um arquivo .env baseado no .env.example:
✅VariávelDescriçãoObrigatóriaBOT_TOKENToken do seu bot
❌DATABASE_URLURL de conexão com o banco
❌PORTPorta do servidor (padrão: 3000)

Como obter o token do bot

Acesse o Binance testenet Portal Crie uma nova 
BINANCE_API_KEY=
BINANCE_API_SECRET=

Vá para a seção "Bot"
Copie o token e cole no arquivo .env

📚 Comandos Disponíveis
Comando Descrição
Exemplo
!help Mostra lista de comandos
!help!ping Verifica se o bot está online
!ping!info Mostra informações do servidor
!info
🔧 Scripts Disponíveis
npm start          # Inicia o bot em produção
npm run dev        # Inicia o bot em modo desenvolvimento
npm test           # Executa os testes
npm run lint       # Verifica problemas no código

🐛 Problemas Conhecidos

Uso de memoria ainda elevado

🤝 Como contribuir

Faça um fork do projeto
Crie uma branch para sua feature (git checkout -b feature/MinhaFeature)
Commit suas mudanças (git commit -m 'Adiciona nova feature')
Push para a branch (git push origin feature/MinhaFeature)
Abra um Pull Request

📄 Licença
Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.
📞 Contato

Autor: Bruno
Email: wwwbrruno@gmail.com
LinkedIn: ----
GitHub: ----

🙏 Agradecimentos

Bibliotecas e ferramentas utilizadas 
Claude IA