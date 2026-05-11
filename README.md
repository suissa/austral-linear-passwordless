# austral-linear-passwordless

Módulo passwordless em Austral que modela WebAuthn com tipos lineares.

## Módulos

- `Austral.Passwordless.WebAuthn.Core`: tipos compartilhados, opções WebAuthn, respostas do navegador e cerimônias lineares.
- `Austral.Passwordless.WebAuthn.Backend`: fluxo de backend para emitir, concluir ou abandonar cerimônias de registro/autenticação.
- `Austral.Passwordless.WebAuthn.Frontend`: helpers de frontend que emitem HTML controlado por Austral e convertem posts em respostas WebAuthn.

## Propriedade linear

`Challenge`, `RegistrationCeremony`, `AuthenticationCeremony` e `ChallengeEntropy` são tipos `Linear`. Isso força o chamador a consumir uma cerimônia exatamente uma vez: completar ou abandonar. O objetivo é impedir, no nível de tipo, vazamento de desafio, replay acidental e dupla finalização.

## Observação de segurança

A implementação mantém a fronteira WebAuthn em Austral e deixa os pontos dependentes de plataforma (randomness criptográfica real, validação CBOR/COSE e verificação de assinatura) encapsulados nas funções de backend. Em uma integração de produção, esses pontos devem ser ligados a uma FFI auditada ou a módulos Austral equivalentes de criptografia/CBOR.
