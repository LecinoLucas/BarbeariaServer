# Protecao de Repositorio

## Branches

- Branch oficial de desenvolvimento: `dev`
- Manter `main` vazia ate decisao futura sobre publicacao

## Regras sugeridas

- Proteger `dev` quando o fluxo com PR estiver estabilizado
- Exigir testes antes de merge quando CI existir
- Evitar push direto em `dev` quando a rotina de PR estiver pronta

## Cuidados

- Nao fazer force push sem backup explicito
- Nao reescrever historico nesta fase
- Nao popular `main` com os arquivos do backend nesta etapa
- Se for necessario limpar historico no futuro, abrir uma fase separada `INFRA-3 - limpeza de historico com backup`
- Nao rodar `git filter-repo` nem BFG nesta fase
