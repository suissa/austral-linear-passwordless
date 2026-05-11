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

## Página single-file Passkey DPoP

A demonstração `public/passkey-dpop.html` contém HTML, CSS e JavaScript puros no mesmo arquivo. Ela registra uma passkey WebAuthn real quando disponível, usa um adaptador virtual para ambientes de teste e, depois do registro, cria um token DPoP assinado por uma assertion WebAuthn vinculada ao `credentialId` da passkey.

A própria página inclui botões para executar testes unitários, BDD e E2E sem dependências externas. Para validação em ambiente sem navegador, o script embutido pode ser extraído e executado com Node usando o adaptador virtual.


## Executando API e front

A API agora está em `server.mjs`. Ela usa apenas módulos nativos do Node.js e expõe:

- `GET /api/health`: status da API e caminho do front.
- `POST /api/webauthn/register/options`: gera opções de registro WebAuthn/passkey.
- `POST /api/webauthn/register/verify`: valida o retorno de registro usado pelo demo.
- `POST /api/dpop/verify`: valida a estrutura do token DPoP e confere se o `kid`, `cnf.kid` e `passkey_credential_id` apontam para a mesma passkey.

Scripts npm disponíveis:

- `npm run dev` ou `npm start`: sobe API e front juntos em `http://127.0.0.1:3000`.
- `npm run api`: sobe somente as rotas `/api/*`.
- `npm run front`: sobe somente o front estático.
- `npm test`: executa testes unitários, BDD e E2E com o adaptador virtual de passkey.

O front fica em `public/passkey-dpop.html` e é servido por padrão em `http://127.0.0.1:3000/passkey-dpop.html`.
