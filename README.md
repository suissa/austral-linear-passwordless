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

## Aurora Zeroize Security

A arquitetura Aurora foi adicionada como contratos Austral para manter a semântica de segurança no plano de tipos, sem implementar Rust, Zig, Go ou Gleam neste repositório.

### Camadas

- `Austral.Passwordless.Aurora.Memory`: modela `SecretResource`, `LockedSecretPage`, `BorrowedSecret` e `PurgedSecret` como tipos lineares. O contrato separa dados públicos de handles opacos e exige consumo explícito por processamento com zeroização ou purga.
- `Austral.Passwordless.Aurora.Identity`: modela o Gerenciador de Identidades como raiz de confiança. Agentes enviam manifesto, nonce, chave pública efêmera e attestation; o gerenciador valida a política e emite apenas um grant cifrado.
- `Austral.Passwordless.Aurora.Transport`: modela o request/reply NATS com payloads que não conseguem representar segredo em texto claro.
- `Austral.Passwordless.Aurora.Storage`: modela o mount local estilo BadgerDB com `chmod 0700`, criptografia em repouso e consumo linear da chave para retornar uma prova `PurgedSecret`.

### Invariantes de segurança

1. Segredos nunca são representados como `String` nos módulos Aurora; apenas descritores públicos e recursos lineares opacos atravessam as APIs.
2. O agente não fala diretamente com o cofre. A única entrada para segredos é o `AuthorizedIdentityGrant` emitido pelo gerenciador após validação do manifesto.
3. O hash de identidade é vinculado a uma `Attestation` com `Nonce` e `EphemeralPublicKey`, reduzindo replay de manifesto estático.
4. O mount de storage consome `BorrowedSecret` e força uma saída de zeroização (`PurgedSecret`) antes de encerrar o fluxo.
5. O transporte carrega manifesto, attestation e grants cifrados; o segredo em claro não existe no contrato NATS.

### Fronteira com runtimes externos

Em produção, os tipos lineares de Aurora devem ser ligados a NIF Resources, buffers travados e primitivas de zeroização segura. Neste repositório, essa fronteira está expressa somente em Austral: o objetivo é garantir que a máquina de estados de segurança não permita duplicar, esquecer ou serializar segredos em texto claro.
