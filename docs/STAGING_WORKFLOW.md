# Ambiente de homologação

O Arcadia agora possui dois ambientes independentes de publicação:

- **Oficial:** https://cryptominerarcadia.com
- **Homologação (privado):** https://crypto-miner-arcadia-staging.mateusmoraes12345678.chatgpt.site

## Como usar

1. Toda alteração nova deve ser validada primeiro na homologação.
2. Faça login na aplicação de homologação com a mesma conta do workspace que tem acesso ao projeto.
3. Teste navegação, responsividade, salas, racks, temporada, jogos e telas administrativas.
4. Registre qualquer ajuste necessário e só publique no domínio oficial depois da revisão.

## Proteções atuais

- A homologação é privada e não aparece em mecanismos de busca.
- Pix, depósitos cripto, saques manuais e pagamentos reais ficam desativados nesse ambiente.
- O Mercado Pago está em modo de teste e o provedor cripto está em modo sandbox.
- A publicação oficial continua apontando exclusivamente para `cryptominerarcadia.com`.

## Regra de dados e pagamentos

Não use credenciais de produção na homologação. Para testar autenticação e fluxos persistentes com segurança, o próximo passo é criar um projeto Supabase de teste e credenciais sandbox separadas. A homologação deve usar apenas dados fictícios; saldos, webhooks, chaves de pagamento e saques reais nunca devem ser compartilhados entre os ambientes.

## Fluxo de publicação

**Editar → validar na homologação → revisar → aprovar → publicar no oficial.**

Se um teste falhar, o domínio oficial não é alterado. Se uma publicação oficial apresentar problema, a versão anterior permanece disponível para retorno controlado.
