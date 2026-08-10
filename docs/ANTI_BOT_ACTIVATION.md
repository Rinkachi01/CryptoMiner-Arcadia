# Anti-bot dos minigames — ativação segura

Atualizado em 9 de agosto de 2026.

## O que já está pronto

- O prêmio é calculado e confirmado no servidor, nunca pelo navegador.
- Início, eventos e conclusão possuem limites independentes por conta.
- Sequências impossivelmente rápidas, fora de ordem ou mecanicamente uniformes
  são recusadas sem recompensa e entram no painel de segurança.
- O Turnstile é validado no servidor com ação, hostname e IP remoto, sem
  armazenar token ou criar impressão digital invasiva.
- O passe humano dos minigames dura quatro horas. Uma falha reinicia o desafio
  para impedir reutilização do mesmo token.

## O que falta para ativar em produção

O segredo cadastrado no Supabase protege somente cadastro e login. Para proteger
os minigames, o mesmo widget precisa estar configurado no ambiente do Worker.

1. No widget Turnstile, autorizar o hostname atual
   `crypto-miner-arcadia.criptomineracardia.workers.dev` e, futuramente, o
   domínio definitivo.
2. Salvar `TURNSTILE_SECRET` como segredo do Worker. Nunca colocá-lo em arquivo
   público ou variável do navegador.
3. Confirmar `TURNSTILE_SITE_KEY` e `TURNSTILE_HOSTNAME` nas variáveis do Worker.
4. Manter `TURNSTILE_REQUIRED=false` durante o primeiro teste.
5. Testar com uma conta comum: abrir Arcade, concluir o desafio, jogar, recarregar
   a página e confirmar que o passe continua válido.
6. Conferir os eventos na Central do Proprietário e só então mudar
   `TURNSTILE_REQUIRED=true` e publicar novamente.

Se o segredo estiver ausente e a obrigatoriedade for ativada, o Arcade fecha por
segurança. Por isso a ordem acima deve ser mantida.

