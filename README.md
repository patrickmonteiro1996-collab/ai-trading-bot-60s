# AI Trading Bot 60s — protótipo de simulação

## O que esta versão faz
- Interface mobile/PWA para iPhone.
- Obtém candles de 1 minuto e preços públicos através da API pública Binance Spot.
- Calcula sinais experimentais com EMA 9/21, momentum e RSI.
- Simula uma operação direcional de 60 segundos com aposta virtual fixa de 2 CHF.
- Payout hipotético: +70% quando acerta; -100% da aposta quando falha.
- Carteira virtual inicial: 100 CHF.

## Limitações importantes
- Isto **não é uma IA treinada**: é uma estratégia heurística simples e experimental.
- Não é uma opção binária real, não envia ordens e não aceita depósitos.
- A simulação mede a direção entre o preço consultado no início e o preço consultado no fim; não replica a liquidação de qualquer plataforma.
- Não é garantido que a API esteja disponível em todos os países ou redes. Pode haver falhas, atrasos, limites ou alterações.
- O histórico e o saldo são mantidos apenas na memória da página; ao recarregar, reiniciam.
- A app não executa em segundo plano no iPhone. O iOS suspende páginas web quando fechadas; o service worker só faz cache/offline, não mantém o bot ativo 24/7.
- Antes de qualquer uso real, seria necessário backtest rigoroso, validação estatística, servidor persistente e revisão legal/regulatória. Não ligue chaves de levantamento.

## Publicar gratuitamente com GitHub Pages
1. Crie um repositório GitHub novo e privado ou público.
2. Carregue todos os ficheiros desta pasta para a raiz do repositório.
3. Em Settings → Pages, escolha Deploy from a branch, branch `main`, folder `/root`.
4. Aguarde o endereço HTTPS fornecido pelo GitHub Pages.
5. No iPhone, abra esse endereço no Safari → Partilhar → Adicionar ao ecrã principal.

## Teste
Abra o endereço HTTPS no Safari. Aguarde os preços. Escolha um ativo; quando surgir UP ou DOWN, prima “Iniciar simulação de 2 CHF”. O resultado é registado após 60 segundos se a cotação final estiver disponível.

## Ponto de equilíbrio do payout
Com payout de 70%, a taxa teórica de acerto para break-even é 2/(2+1.4) = 58,82%, antes de custos, diferenças de preço e erros de execução.
