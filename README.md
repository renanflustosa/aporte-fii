# fiis

CLI que diz em quais FIIs pôr o aporte do mês, para uma carteira de longo prazo focada em renda mensal. Ela nunca sugere venda: o rebalanceamento acontece só pelos aportes.

## Uso

Requer Node 24 ou mais recente; não há etapa de build.

```bash
npm install                            # só o typescript para o type-check
cp carteira.example.json carteira.json # depois preencha com a sua carteira real
node src/main.ts                       # usa o aporte do carteira.json
node src/main.ts 1500                  # aporte deste mês
```

Depois de comprar, atualize `cotas` no `carteira.json`. Ele fica fora do git porque guarda a sua posição real.

## carteira.json

| Campo | O que é |
|---|---|
| `aporte` | Valor padrão do aporte mensal em R$ |
| `dyMinimo` | DY anual mínimo para comprar (`0.1` = 10%). Define o preço teto |
| `mesesMinimos` | Meses com provento nos últimos 12 para o FII poder ser comprado (`11` tolera um provento com data-com na borda da janela) |
| `rendaAlvo` | Opcional: renda mensal desejada na aposentadoria, em R$ |
| `fiis[].ticker` | Código na B3, ex.: `MXRF11` |
| `fiis[].peso` | Peso relativo na carteira (`1` para todos = pesos iguais; `2` = o dobro) |
| `fiis[].cotas` | Cotas que você já tem |

Os FIIs do exemplo servem só para mostrar o formato; não são recomendação.

## Regras

1. **Dados**: cotação e proventos dos últimos 12 meses vêm do Yahoo Finance, que não pede chave.
2. **Filtro**: um FII só entra no aporte se pagou provento em pelo menos `mesesMinimos` meses e se o preço está até o **preço teto de Bazin** (`proventos 12m / dyMinimo`). Acima do teto, o DY fica abaixo do mínimo e vale esperar o preço cair.
3. **Aporte**: compra uma cota por vez do FII elegível mais abaixo da meta, proporcionalmente ao peso, até o dinheiro não pagar mais nenhuma cota. O que sobrar fica para o próximo mês.
4. **Saída**: além das compras, mostra a renda mensal estimada (média dos últimos 12 meses), o **número mágico** de cada FII (a partir de quantas cotas o provento do mês compra uma cota nova) e o progresso até a `rendaAlvo`.

Proventos passados não garantem os futuros. A escolha dos FIIs e dos pesos continua sendo sua; a ferramenta só automatiza a decisão de cada mês.

## Checks

```bash
node --test                          # testes das regras (src/carteira.ts)
node node_modules/typescript/bin/tsc # type-check
```
