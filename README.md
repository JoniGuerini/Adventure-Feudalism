# Adventure Feudalism

Jogo idle de produção feudal, inspirado em Adventure Communist. Toda a pixel art é desenhada em código: não há nenhuma imagem no projeto, só HTML, CSS e JavaScript puro.

> Nome provisório.

## Produção

Em cada linha, cada tier produz 1 unidade a mais por ciclo que o tier de baixo e leva o dobro do tempo. Cada linha começa com 1 de produção e 1 segundo de ciclo a mais que a anterior:

| Linha | Tier 1 | Tier 2 | Tier 3 |
| --- | --- | --- | --- |
| Comida | 3 a cada 2s | 4 a cada 4s | 5 a cada 8s |
| Militar | 4 a cada 3s | 5 a cada 6s | 6 a cada 12s |
| Alquimia | 5 a cada 4s | 6 a cada 8s | 7 a cada 16s |
| Minérios | 6 a cada 5s | 7 a cada 10s | 8 a cada 20s |
| Exploração | 7 a cada 6s | 8 a cada 12s | 9 a cada 24s |

## Marcos, missões e cartas

Cada gerador dá **coroas** quando chega a 10, 100, 1.000 unidades e assim por diante (o marco *k* vale *k* × tier coroas).

As melhorias são **cartas**, como os pesquisadores do Adventure Communist. Elas vêm de **baús**, que vêm das **missões** (3 por vez, sempre à vista no topo da tela). Cumprir as missões exigidas sobe o **Renome**, que dá um baú melhor; nada é zerado. Subir uma carta de nível gasta cópias dela e coroas, e cada raridade tem nível máximo:

| Raridade | Cartas | Efeitos | Nível máx. |
| --- | --- | --- | --- |
| Comum | uma por gerador (a ferramenta dele) | Fartura: +50% de produção por nível | 10 |
| Rara | três por linha | Velocidade +25% por nível, Sorte (colheita farta), Recrutamento | 8 |
| Épica | duas por linha e duas do reino | Desconto, Bonança, mais cartas ou coroas por baú | 6 |
| Lendária | quatro do reino | Produção, Sorte, Bonança e Desconto em tudo | 5 |

Cópias por nível: 1, 2, 5, 10, 20, 50, 100, 200, 400, 800. Os números de balanceamento ficam no objeto `BAL` e em `RARITIES`, no topo de `meta.js`.

## Servos

Todo gerador comprado custa **servos**: 1 na Comida, 2 na Militar, até 5 na Exploração. Eles nascem sozinhos (1 por segundo) depois da primeira compra. O **Recrutamento** de cada linha gasta o recurso dela (5 mil, 5 milhões, 5 bilhões...) e aumenta os servos por segundo.

## Como jogar localmente

Não precisa instalar nada. Basta abrir o `index.html` no navegador.

Se preferir um servidor local (recomendado, evita restrições de alguns navegadores):

```bash
npx serve .
# ou
python -m http.server 8000
```

E abrir `http://localhost:8000` (ou o endereço que o `serve` mostrar).

## Publicar na Vercel

1. Entre em [vercel.com/new](https://vercel.com/new) com a conta do GitHub.
2. Escolha **Import** no repositório `adventure-feudalism`.
3. Em **Framework Preset**, deixe **Other**. Não precisa de comando de build nem de pasta de saída.
4. Clique em **Deploy**.

A cada `git push` na branch `main`, a Vercel publica a nova versão sozinha.

## Estrutura

| Arquivo | O que faz |
| --- | --- |
| `index.html` | Página do jogo |
| `style.css` | Visual da interface |
| `pixel.js` | Motor de pixel art |
| `art.js` | Paleta, molduras, silhuetas, cursores e barra de rolagem |
| `scene.js` | Base das cenas panorâmicas de cada linha |
| `art-comida*.js` | Linha da comida: cena da fazenda e 15 geradores |
| `art-militar*.js` | Linha militar: pátio do castelo e 15 geradores |
| `art-alquimia*.js` | Linha da alquimia: horta e 15 geradores |
| `art-minerios*.js` | Linha dos minérios: cena da mina e 15 geradores |
| `art-exploracao*.js` | Linha da exploração: cena da fronteira e 15 geradores |
| `sfx.js` | Sons gerados em código |
| `ui-scroll.js` | Barra de rolagem própria |
| `big.js` | Números gigantes (até 10↑↑9e15, no nível da break_eternity), sem biblioteca de fora |
| `game.js` | Lógica do jogo: produção, compras, marcos, tela dos geradores |
| `meta.js` | Cartas, servos, missões e baús (só regras e números) |
| `meta-ui.js` | Telas das cartas, das missões, do recrutamento e da abertura de baús |
| `art-meta.js` | Ícones das cartas e os baús |

O progresso fica salvo no `localStorage` do navegador.
