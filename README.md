# Adventure Feudalism

Jogo idle de produção feudal, inspirado em Adventure Communist. Toda a pixel art é desenhada em código: não há nenhuma imagem no projeto, só HTML, CSS e JavaScript puro.

> Nome provisório.

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
| `art.js` | Paleta, molduras, silhuetas e barra de rolagem |
| `scene.js` | Cenas de cada linha |
| `art-comida*.js` | Retratos da linha de comida (15 geradores) |
| `art-militar.js`, `art-alquimia.js` | Arte das linhas militar e alquimia |
| `sfx.js` | Sons gerados em código |
| `ui-scroll.js` | Barra de rolagem própria |
| `game.js` | Lógica do jogo |

O progresso fica salvo no `localStorage` do navegador.
