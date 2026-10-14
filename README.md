# Adventure Feudalism

Jogo idle de produção feudal, inspirado em Adventure Communist. Toda a pixel art é desenhada em código: não há nenhuma imagem no projeto, só HTML, CSS e JavaScript puro.

> Nome provisório.

## Marcos e melhorias

Cada gerador dá **coroas** quando chega a 10, 100, 1.000 unidades e assim por diante (o marco *k* vale *k* × tier coroas). As coroas compram melhorias por gerador na aba **Melhorias**:

| Melhoria | Efeito por nível |
| --- | --- |
| Ritmo | ciclo ÷ 2 |
| Fartura | produção × 2 |

Toda melhoria custa 1 coroa no primeiro nível e dobra a cada compra (1, 2, 4, 8...), em qualquer tier e qualquer linha.

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
| `game.js` | Lógica do jogo |

O progresso fica salvo no `localStorage` do navegador.
