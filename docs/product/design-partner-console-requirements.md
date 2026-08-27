---
aliases:
  - EEM Design Partner Console
  - EEM Design Partner Alpha requirements
tags:
  - evirion
  - eem
  - product
  - design-partner
  - console
  - requirements
status: accepted
version: 1.0
updated: 2026-08-25
---

> [!NOTE] Accepted source snapshot
> Migrated for EEM-9/01 from the accepted 2026-08-25 package.
> Vault-relative source: `10 Evirion/01 Products/EEM - Design Partner Console requirements.md`.
> Original source SHA-256: `832cc5bf8352d8995598b4256c451dd54fb333683a206c93533dbe4b6e195fd4`.
> The repository copy is authoritative after the paired EEM-9/01 merges.
> Retained security and operations sources:
> `10 Evirion/Architecture/EEM - OWASP-аудит и модель угроз.md` and
> `10 Evirion/Architecture/EEM - Полный runbook запуска и эксплуатации.md`.


# EEM — Design Partner Console: product and business requirements

> [!info] Accepted Dashboard authority transfer
> Пакет требований утверждён пользователем 2026-08-25 и перенесён в
> `Evirion/evirion-engineering-memory-dashboard` под EEM-9/01. Эта repository
> copy становится detailed authority только на exact Dashboard commit и
> authority-package digest после последовательного merge Dashboard PR и
> backend stable-pointer PR. До обоих merge portable program design и
> source-controlled EEM-4/EEM-6–9 active plans в backend repository остаются
> cross-repository authority.
>
> Текущий код, executable tests и migrations остаются authority для уже
> реализованного поведения. Этот документ задаёт target behavior, но сам по
> себе не означает, что Console реализована, развёрнута или сертифицирована.

Связанные документы:

- [EEM - Design Partner Console architecture](../architecture/design-partner-console.md)
- [EEM - Design Partner Console implementation plan](../plans/design-partner-console-implementation.md)
- [Evirion Engineering Memory](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/)
- [EEM - Архитектура базы данных](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/services/model-orchestration/SUPABASE_DATABASE_ARCHITECTURE.md)
- [EEM - Модель Organization и Repository](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/docs/architecture/organization-repository-model.md)
- [EEM - Сценарии PR Watcher и Backfill](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/services/model-orchestration/BACKFILL_RUNBOOK.md)
- [EEM - OWASP-аудит и модель угроз](obsidian://open?vault=Obsidian%20Vault&file=10%20Evirion%2FArchitecture%2FEEM%20-%20OWASP-%D0%B0%D1%83%D0%B4%D0%B8%D1%82%20%D0%B8%20%D0%BC%D0%BE%D0%B4%D0%B5%D0%BB%D1%8C%20%D1%83%D0%B3%D1%80%D0%BE%D0%B7.md)
- [EEM - Полный runbook запуска и эксплуатации](obsidian://open?vault=Obsidian%20Vault&file=10%20Evirion%2FArchitecture%2FEEM%20-%20%D0%9F%D0%BE%D0%BB%D0%BD%D1%8B%D0%B9%20runbook%20%D0%B7%D0%B0%D0%BF%D1%83%D1%81%D0%BA%D0%B0%20%D0%B8%20%D1%8D%D0%BA%D1%81%D0%BF%D0%BB%D1%83%D0%B0%D1%82%D0%B0%D1%86%D0%B8%D0%B8.md)
- Repository locator: `Evirion/evirion-engineering-memory/docs/superpowers/specs/2026-08-25-design-partner-console-program-design.md`
- Repository locator: `Evirion/evirion-engineering-memory/docs/plans/active/eem-9-design-partner-console-dashboard-and-certification.md`

До EEM-9/01 агент начинает с source-controlled EEM-9 execution plan: в нём
закреплены Supabase Auth, UI → BFF → backend flow, OWASP acceptance matrix и
task-specific список разделов этой заметки. После EEM-9/01 использовать
digest-pinned копию требований в Dashboard repository, а эту заметку —
как parity check.

Исходный документ:

- imported historical filename:
  `EVIRION_DESIGN_PARTNER_CONSOLE_IMPLEMENTATION_PLAN.md`; local download path
  is intentionally not portable or authoritative

## 0. Accepted EEM program decomposition

Утверждённая реализация разделена по связным trust/state boundaries:

- **EEM-4 — Customer Access and Tenant Isolation:** API/command foundation,
  Supabase Auth, invitations, live membership/RBAC и tenant/RLS certification;
- **EEM-6 — Repository Entitlements and GitHub Control:** limits, entitlement
  generation, operator organization control, GitHub control plane и free-path
  enforcement;
- **EEM-7 — Paid-call Authorization and Customer Operations:** logical
  authorization, append-only dispatch, operator authorization и guarded
  import/approve/retry API;
- **EEM-8 — Customer-safe API, Review and Lifecycle:** immutable review,
  lifecycle/corrections, customer-safe projections и metrics;
- **EEM-9 — Dashboard and Cross-repository Certification:** Console repository,
  UI/BFF slices, free integration, separately approved paid certification и
  Technical Design Partner Ready plus separately approved first-partner outcome.

Существующий **EEM-5** остаётся отдельным source-runtime deployment/observation
track. Идентификаторы `P01`, `B01`–`B09`, `C01`–`C06` и `I01`–`I03`
сохраняются как immutable traceability aliases; branch/PR ownership задают
source-controlled active EEM plans.

## 1. Executive summary

Design Partner Console — минимальный customer-facing control plane для
подключения design partner, управления разрешёнными repositories, запуска
существующего historical backfill и human review извлечённой Engineering
Memory.

Console не заменяет extraction platform и не создаёт альтернативные:

- PR collector;
- Source Envelope;
- extraction/admission pipeline;
- idempotency;
- checkpoint;
- budget policy;
- backfill state machine;
- trusted persistence boundary.

Главная Alpha-гипотеза:

> Реальная engineering-команда может безопасно подключить один или несколько
> явно разрешённых repositories, получить evidence-backed Knowledge Objects и
> дать структурированную обратную связь, достаточную для измерения качества и
> полезности Engineering Memory.

## 2. Readiness decision

### 2.1 Что можно делать сейчас

До завершения EEM-3 разрешены:

- анализ;
- product specification;
- technical architecture;
- API contract design;
- implementation planning;
- threat modeling;
- подготовка acceptance и traceability matrices.

### 2.2 Когда начинается реализация

Реализация начинается только после того, как:

1. все EEM-3 pull requests merged;
2. EEM-3 complete free local gate прошёл;
3. EEM-3 free staging reset/recertification завершён;
4. актуальные semantic identity, execution provenance, worker, checkpoint,
   backfill и consumer contracts зафиксированы;
5. исходный backend branch `main` не содержит незавершённой EEM-3 migration
   chain.

Technical Design Partner Ready дополнительно требует завершённый EEM-5 или эквивалентное
подтверждение, что source worker реально развёрнут, непрерывно наблюдается и
может безопасно работать в целевой Linux staging environment.

### 2.3 Paid gate

Paid staging E2E не блокирует проектирование или последующую fixture-driven
разработку Console.

Paid staging E2E является обязательным gate перед:

- Technical Design Partner Ready;
- обработкой real partner repository через Console;
- заявлением о работоспособности paid historical import;
- внешним Alpha release.

Каждый реальный paid run требует:

1. **customer consent** — Organization Owner/Admin разрешает конкретный
   BackfillRun либо явно включает `AUTO_EXTRACT` для live policy;
2. **Evirion operational authorization** — отдельно подтверждает environment,
   model/profile, maximum call count, maximum budget, expiry и допустимые
   retries для staging/Alpha;
3. durable per-call authorization непосредственно перед каждым provider
   request.

Customer consent не заменяет operational authorization. Operational
authorization не заменяет entitlement, policy, budget или customer consent.

## 3. Product problem

Существующий backend может собирать merged PR, строить Source Envelopes,
выполнять extraction, валидировать результат и сохранять immutable provenance.
Но design partner пока не может самостоятельно:

- войти в продукт;
- связать себя с Organization;
- подключить GitHub App;
- отличить GitHub-accessible repository от Evirion-enabled repository;
- активировать разрешённый repository;
- подготовить historical import;
- явно подтвердить начало paid stage;
- наблюдать processing без доступа к operator CLI;
- проверить Knowledge Object и exact evidence;
- approve, edit или reject knowledge;
- определить current lifecycle;
- увидеть admission failure отдельно от Engineering Memory.

Без Console невозможно полноценно проверить:

- понятность extracted knowledge;
- долю принятия без изменений;
- характер human edits;
- причины human rejection;
- долю исторических объектов, которые всё ещё active;
- применимость supersession;
- operational usability для design partner.

## 4. Goals

### G-001 — Safe onboarding

Design partner может войти, подключить существующий GitHub App и увидеть
доступные repositories без автоматического ingestion.

### G-002 — Explicit repository authorization

Только repository с `ACTIVE` product entitlement может создавать новую
processing work.

### G-003 — Existing workflow reuse

Historical import и live merged-PR ingestion используют существующие backend
state machines, idempotency, checkpoint, policy и budget guards.

### G-004 — Human validation

Reviewer может проверить exact evidence и записать immutable
approve/edit/reject decision без изменения machine provenance.

### G-005 — Lifecycle feedback

Reviewer может независимо от admission и review определить, является ли
knowledge unresolved, active или superseded.

### G-006 — Operational transparency

Admin видит jobs, runs, admission outcomes, validation failures, usage, cost и
latency через безопасные projections, не получая raw secrets или unrestricted
provenance access.

### G-007 — Measurable Alpha

Система автоматически рассчитывает product и operational metrics первого
design partner.

## 5. Non-goals

В Design Partner Console Alpha не входят:

- retrieval/chat;
- answer synthesis;
- MCP management;
- automatic lifecycle inference;
- automatic supersession;
- generic knowledge graph visualization;
- billing checkout;
- Stripe subscription management;
- unrestricted self-service repository rotation;
- enterprise SSO, SAML или SCIM;
- advanced RBAC;
- Slack, Jira, Notion или Confluence ingestion;
- GitLab или Bitbucket;
- mobile application;
- notification center;
- customer-visible raw model responses;
- arbitrary retry, replay или queue manipulation;
- UI-only cancellation;
- autonomous edits of Engineering Memory;
- public self-signup.

## 6. Terminology

### 6.1 Source permission

GitHub App installation имеет технический доступ к repository. Это не даёт
Evirion product entitlement.

### 6.2 Repository entitlement

Product/commercial authorization, разрешающий Evirion обрабатывать конкретный
repository.

### 6.3 Repository policy

Processing behavior разрешённого repository: live automation, budget,
parallelism и другие operational limits.

### 6.4 Admission

Machine-enforced результат extraction:

- `ACCEPTED`;
- `REJECTED`;
- `QUARANTINED`.

### 6.5 Admitted Knowledge Object

Knowledge Object, созданный только из `ACCEPTED`, valid и
trusted-memory-eligible AdmissionRecord.

### 6.6 Human review

Независимая оценка admitted Knowledge Object:

- `PENDING`;
- `APPROVED`;
- `EDITED`;
- `USER_REJECTED`.

### 6.7 Lifecycle

Независимая оценка current validity:

- `UNRESOLVED`;
- `ACTIVE`;
- `SUPERSEDED`.

Machine field `knowledgeStatus` from extraction remains immutable source
content and does not automatically set this human lifecycle axis.

### 6.8 Processing outcome

Job/run/admission result. `REJECTED` и `QUARANTINED` являются processing
outcomes, но не Knowledge Objects.

### 6.9 Effective knowledge

Machine-extracted immutable Knowledge Object плюс последняя применимая
immutable human edit. Original representation всегда восстанавливается.

## 7. Existing foundation and gap assessment

### 7.1 Реализовано и переиспользуется

- merged-PR GitHub ingestion;
- Source Envelope collection и validation;
- isolated extraction;
- `ACCEPTED` / `REJECTED` / `QUARANTINED`;
- immutable Source Envelopes, runs, attempts, checkpoints и admission;
- Knowledge Objects и Evidence только после accepted admission;
- tenant-aware composite foreign keys;
- forced RLS;
- least-privileged runtime roles;
- webhook idempotency;
- semantic extraction idempotency;
- checkpoint-before-validation;
- backfill create/discover/approval/state machine;
- repository automation policy;
- budget checks;
- organizations, memberships, installations и repositories;
- `knowledge_relations`;
- `knowledge_state_events`;
- audit/job/outbox events.

### 7.2 Отсутствует

- browser product;
- Next.js Console;
- Console BFF;
- product Auth UX;
- invitation flow;
- role-gated customer mutations;
- GitHub installation onboarding/callback;
- accessible-repository synchronization for Console;
- `RepositoryEntitlement`;
- organization repository limit;
- human review records и immutable edits;
- Console-specific current review projection;
- customer-safe processing API;
- Console API contract;
- customer-facing metrics;
- Technical Design Partner Ready certification.

### 7.3 Существующие concepts, которые нельзя дублировать

- `organization_memberships` адаптируется, а не создаётся повторно;
- `knowledge_relations` используется для `SUPERSEDES`;
- `knowledge_state_events` используется для lifecycle;
- `repository_automation_policies` остаётся policy и не превращается в
  entitlement;
- backfill states остаются backend source of truth;
- `api.trusted_knowledge` не переопределяется неявно; Console получает
  отдельные purpose-built projections.

## 8. Actors and capabilities

### 8.1 Organization Owner

Может:

- управлять organization membership;
- подключать и переподключать GitHub App;
- активировать первый разрешённый repository;
- управлять entitlement в пределах organization replacement policy;
- запрашивать operator-controlled replacement для repository-limited Alpha;
- подтверждать paid backfill;
- изменять repository policy;
- выполнять human review;
- менять lifecycle;
- просматривать processing и usage.

### 8.2 Organization Admin

Может:

- подключать GitHub App;
- активировать первый разрешённый repository;
- управлять entitlement в пределах organization replacement policy;
- запрашивать operator-controlled replacement для repository-limited Alpha;
- подтверждать paid backfill;
- изменять repository policy;
- приглашать Reviewer/Viewer, если это разрешено Alpha policy;
- выполнять human review и lifecycle actions;
- просматривать processing и usage.

Не может передать ownership без отдельного owner-only flow.

### 8.3 Reviewer

Соответствует существующему DB role `member`.

Может:

- читать repositories и admitted Knowledge Objects;
- просматривать evidence;
- approve/edit/reject knowledge;
- отмечать active/superseded/unresolved;
- просматривать безопасную PR context.

Не может:

- подключать GitHub;
- активировать repositories;
- менять policy/budget;
- подтверждать paid extraction;
- приглашать admins.

### 8.4 Viewer

Соответствует существующему DB role `viewer`.

Имеет только read-only доступ к customer-safe projections.

### 8.5 Evirion Operator

Не является customer membership role.

Может выполнять отдельно авторизованные:

- entitlement provisioning;
- incident recovery;
- retention/erasure;
- deployment;
- certification;
- paid-run approval.

Operator action всегда audit-logged.

### 8.6 Capability mapping

| Capability | owner | admin | member / Reviewer | viewer |
|---|---:|---:|---:|---:|
| View repositories and memory | yes | yes | yes | yes |
| Connect GitHub | yes | yes | no | no |
| Activate/manage repository entitlement within replacement policy | yes | yes | no | no |
| Change processing policy | yes | yes | no | no |
| Prepare historical import | yes | yes | no | no |
| Approve paid import | yes | yes | no | no |
| Review knowledge | yes | yes | yes | no |
| Change lifecycle | yes | yes | yes | no |
| View customer-safe processing | yes | yes | limited | limited |
| Manage owner/admin roles | yes | no | no | no |

Capability checks выполняются server-side. UI visibility не является security
boundary.

## 9. Business invariants

### BR-001 — Source permission is not entitlement

GitHub App access никогда автоматически не активирует Evirion processing.

### BR-002 — Entitlement precedes policy

`ACTIVE` entitlement необходим, но недостаточен. Policy, budget, approval,
semantic readiness и job eligibility продолжают применяться.

### BR-003 — No work for unentitled repository

Unentitled merged-PR webhook может создать только bounded payload-free audit
receipt. Он не создаёт ExtractionJob, SourceEnvelope, queue work или provider
usage.

### BR-004 — No automatic replay after activation

Webhook, проигнорированный до activation, не переигрывается автоматически.
После activation обрабатываются будущие merges; history импортируется через
backfill.

### BR-005 — Explicit paid approval

Historical import проходит free discovery/source stages и останавливается в
`awaiting_approval`. Customer consent сохраняется как tenant-bound approval
конкретного BackfillRun с workload, budget ceiling, actor, timestamp и
idempotency key. Paid stage начинается только при наличии отдельной Evirion
operational authorization для целевого environment.

Для live merged PR:

- `OFF` не создаёт live processing work;
- `SOURCE_ONLY` разрешает только Source Envelope и оставляет paid gate closed;
- `AUTO_EXTRACT` является persisted customer consent, но каждый реальный Alpha
  call всё равно требует operational authorization.

### BR-006 — Final pre-provider gate

Каждая logical provider operation — initial или validation repair — получает
ровно одну durable authorization. Каждый HTTP dispatch этой operation, включая
bounded transport retry, должен быть покрыт её неизменным dispatch allowance:

```text
RepositoryEntitlement == ACTIVE
AND RepositoryPolicy allows
AND Budget allows
AND Required approval satisfied
AND Runtime/readiness guards pass
AND Paid operational authorization covers phase, attempt, model and budget
```

Техническая linearization point — committed durable authorization для exact:

```text
organization
repository
job
execution
phase: initial | validation_repair
attempt ordinal
canonical request digest
provider and provider-account scope
server-derived provider idempotency key where supported
maximum transport dispatches
entitlement/policy versions
budget reservation
customer consent
operational authorization
```

Она сериализуется с entitlement disable. Authorization, committed до disable,
может завершить только эту logical operation в пределах expiry и captured
dispatch allowance; transport retry переиспользует ту же authorization и не
создаёт новую. После commit disable новая logical authorization невозможна.
Explicit operational-authorization revoke сильнее: он блокирует любой ещё не
начатый dispatch/retry. Database transaction не удерживается во время provider
HTTP request.

### BR-007 — Checkpoint completion

Если successful provider response уже checkpointed, последующее entitlement
disable не может удалить или оставить orphan response. Validation, admission и
persistence завершаются без повторения этого provider phase.

Checkpoint одного phase не разрешает другой phase:

- initial checkpoint валидируется;
- если он требует repair и repair checkpoint отсутствует, repair получает
  отдельную authorization;
- если entitlement уже disabled, новый repair call запрещён, а initial
  invalid response детерминированно завершается как `QUARANTINED` с
  соответствующими validation issues;
- existing repair checkpoint может быть валидирован/persisted без нового call.

Authorized but not dispatched work:

- истёкшая authorization не dispatch-ится;
- каждый dispatch имеет append-only ordinal/status; allowance consumption
  атомарно сериализуется с operational revoke;
- committed append со status `started`, непосредственно перед HTTP, является
  единственной dispatch-start linearization point; отдельного reserved state
  нет;
- dispatched request с неизвестным outcome повторяется автоматически только с
  той же logical authorization, тем же server-derived provider/account-scoped
  idempotency key, неизменным request/model digest и подтверждённой provider
  semantics, если dispatch allowance не исчерпан и operational authorization
  не revoked/expired;
- без такой semantics outcome переводится в operator incident, а не в
  blind paid retry.

### BR-008 — Historical provenance is immutable

Human review, edit и lifecycle actions не изменяют:

- raw response;
- ModelAttempt;
- ExtractionRun;
- AdmissionRecord;
- original Knowledge Object;
- Evidence.

### BR-009 — Admission, review and lifecycle are independent

Ни одно состояние не используется как synonym другого.

### BR-010 — REJECTED/QUARANTINED are not knowledge

Они отображаются в Processing Activity и никогда не создают fake Knowledge
Object cards.

### BR-011 — Pending is derived

`PENDING` означает отсутствие effective human review decision.

### BR-012 — Unresolved is derived

`UNRESOLVED` означает отсутствие effective lifecycle event.

### BR-013 — Supersession direction

Canonical direction:

```text
NEW Knowledge Object SUPERSEDES OLD Knowledge Object
```

### BR-014 — Supersession is atomic

Relation и `SUPERSEDED` lifecycle event старого объекта записываются в одной
transaction.

### BR-015 — New knowledge is not auto-active

Объект, superseding старый объект, остаётся `UNRESOLVED`, пока reviewer явно не
выберет `ACTIVE`.

### BR-016 — Tenant isolation

Каждый entitlement, review, lifecycle event, relation, query и audit record
tenant-scoped. Cross-tenant reference невозможен на constraint layer.

### BR-017 — No unrestricted rotation

Для repository-limited Alpha direct replacement выполняется Evirion operator.
Owner/Admin отправляет request, но не освобождает и не переназначает slot
самостоятельно. Self-service replacement может появиться только как отдельно
утверждённая organization policy. Deactivation не обнуляет historical usage.

### BR-018 — Existing data remains visible

Entitlement disable блокирует новую processing work, но не удаляет ранее
созданную provenance или customer-visible history.

### BR-019 — Backend state is authoritative

Console не создаёт собственную paid/backfill/retry state machine.

### BR-020 — Exact evidence

Human review не может быть завершён как informed action, если reviewer не может
открыть exact evidence и source attribution.

### BR-021 — Durable command idempotency

Каждая customer/operator mutation имеет durable receipt, связывающий
organization, trusted actor, operation, target, idempotency key, canonical
request hash и bounded result. Same key/different request всегда conflict.
External side effects дополнительно имеют domain workflow state и
reconciliation.

### BR-022 — Entitlement generation fence

Каждая admitted source/backfill/paid work item сохраняет entitlement generation
или version, при которой она была разрешена. Disable увеличивает generation.
Claim/authorization stale generation не возобновляется автоматически после
reactivation.

### BR-023 — Organization-wide visibility in Alpha

Membership даёт read access ко всем customer-safe repositories организации.
Repository-scoped ACL отсутствует. Это explicit Alpha assumption, который
design partner подтверждает до onboarding; требование per-repository RBAC
блокирует onboarding этой organization до отдельного design.

### BR-024 — Cost completeness

Cost всегда имеет status:

- `RESERVED`;
- `MEASURED`;
- `UNRESOLVED`;
- `NOT_APPLICABLE`.

Console никогда не отображает reserved/unresolved cost как фактический zero.

## 10. Product information architecture

Alpha включает только:

1. Sign-in and invite acceptance;
2. Onboarding;
3. GitHub connection;
4. Repository management;
5. Repository overview;
6. Historical import;
7. Engineering Memory review queue;
8. Knowledge detail and evidence;
9. Pull request detail;
10. Processing Activity;
11. Minimal settings;
12. Usage and Alpha metrics.

Основные routes:

```text
/auth/*
/onboarding
/repositories
/repositories/:repositoryId
/repositories/:repositoryId/import
/repositories/:repositoryId/memory
/memory
/memory/:knowledgeObjectId
/repositories/:repositoryId/pull-requests/:prNumber
/processing
/settings/members
/settings/github
/settings/usage
```

Route не является authorization boundary. Каждый load и mutation проверяет
session, membership, capability и tenant server-side.

## 11. Functional requirements

### 11.1 Authentication and membership

#### AUTH-001 — Invite-only Alpha

Публичный signup отсутствует. Пользователь получает bounded invitation,
подтверждает email и входит через Supabase Auth email OTP. Magic/Admin invite
links исключены: Supabase Admin invitation не поддерживает PKCE, а Alpha не
помещает Auth/invitation token в URL.

Acceptance:

- неизвестный email не может самостоятельно создать customer organization;
- public signup disabled in local and hosted Supabase Auth configuration;
- passwordless sign-in uses `shouldCreateUser = false`;
- source-controlled local and expected-hosted email templates contain
  `{{ .Token }}` and no `ConfirmationURL`, `TokenHash` or sign-in URL. Their
  canonical subject/body digests, OTP expiry, resend period and redirect
  allowlist are frozen; a synthetic mailbox test proves the delivered message
  contains a bounded code but no Auth/invitation credential-bearing link;
- direct Auth signup/OTP attempts for unknown users fail;
- backend may pre-provision an Auth user only without a password, with
  `email_confirm = false` and no authorization metadata; it grants no
  membership access and does not prove email ownership until server-side OTP
  verification succeeds;
- an existing Auth user is reusable only when its exact email identity matches
  the P01-frozen Alpha provider/identity contract; unsupported or linked
  identities fail final without relinking, OTP send or membership mutation;
- invite одноразовый, истекающий и tenant-bound;
- повторное использование invite не создаёт вторую membership;
- disabled membership теряет доступ без ожидания JWT role refresh;
- auth error не раскрывает существование чужой organization.

#### AUTH-002 — Live membership authorization

Каждый protected request проверяет active membership в database, а не только
JWT metadata.

Acceptance:

- disabled member получает `403`;
- stale JWT не сохраняет доступ;
- `raw_user_meta_data` не используется для authorization;
- caller-supplied `organization_id` не может заменить organization из
  membership context.

#### AUTH-003 — Capability enforcement

Mutation требует соответствующую capability.

Acceptance:

- Reviewer не активирует repository;
- Viewer не создаёт review;
- Admin не передаёт ownership;
- direct RPC invocation даёт тот же deny, что и Console action.

#### AUTH-004 — Organization context

При membership в нескольких organizations пользователь явно выбирает active
organization.

Acceptance:

- active organization хранится как UI preference, не authorization fact;
- каждый API request независимо tenant-scoped;
- изменение URL или local storage не открывает другой tenant.

#### AUTH-005 — Durable invitation lifecycle

Invitation имеет states:

```text
REQUESTED
AUTH_USER_CREATED
SENT
ACCEPTED
REVOKED
EXPIRED
FAILED

OTP delivery effect per invitation generation:
PENDING -> STARTED -> SENT
PENDING -> FAILED_RETRYABLE | FAILED_FINAL
STARTED -> OUTCOME_UNKNOWN | FAILED_FINAL
FAILED_RETRYABLE -> STARTED
OUTCOME_UNKNOWN -> SENT | DELIVERED_BY_VERIFICATION | FAILED_FINAL

pre-auth transaction:
ISSUED -> OTP_REQUEST_STARTED -> OTP_REQUESTED
  -> OTP_VERIFY_STARTED -> OTP_VERIFIED -> BOOTSTRAP_PENDING -> CONSUMED
OTP_REQUEST_STARTED -> OUTCOME_UNKNOWN
OTP_VERIFY_STARTED -> VERIFY_OUTCOME_UNKNOWN
ISSUED/OTP_REQUESTED/OUTCOME_UNKNOWN/VERIFY_OUTCOME_UNKNOWN
  -> REVOKED | EXPIRED | FAILED
```

Acceptance:

- raw token не сохраняется;
- resend сохраняет history и не создаёт duplicate membership;
- provider has no application idempotency key, so each generation has at most
  one automatic send attempt. Response loss after request dispatch records
  `OUTCOME_UNKNOWN` and never auto-resends; after cooldown an explicit
  owner/invitee resend creates the next generation and may supersede an earlier
  delivered code;
- claim/lease and generation prevent competing reconcilers from sending the
  same generation; revoke/expire during an unknown send still prevents
  bootstrap/acceptance even if the email arrives;
- successful verification may reconcile only the same still-current unknown
  send generation to `DELIVERED_BY_VERIFICATION` in the acceptance
  transaction. Resend/revoke/expire fences old codes even if provider
  verification succeeds;
- lost `verifyOtp` response records `VERIFY_OUTCOME_UNKNOWN`, performs no
  automatic verify retry and cannot register membership/session; any provider
  session created by that response is application-unregistered and denied
  while an explicit cooldown-bound resend starts a new generation;
- Auth success + DB failure и DB success + email failure имеют idempotent
  reconciliation;
- revoke/expire блокируют acceptance;
- invitation actor, role, email target, expiry и bounded failure code
  audit-logged;
- concurrent final-owner/role transitions serialize at organization boundary.

#### AUTH-006 — Secure organization bootstrap

Первую Organization, Owner membership, repository limit и operator policy
создаёт authenticated Evirion operator workflow.

Acceptance:

- operator principal derived from trusted platform identity, not request text;
- bootstrap idempotent;
- no public/customer bootstrap endpoint;
- Organization и first Owner commit atomically or reconcile through durable
  workflow state;
- missing repository limit remains fail-closed;
- every bootstrap/retry/failure audit-logged.

#### AUTH-007 — MFA, session and recovery security

Backend authorization permits only invite-only verified email OTP plus TOTP
MFA. Owner/Admin and Evirion operator privileged mutations require backend-
enforced `aal2`; an UI-only MFA check cannot authorize.

Acceptance:

- BFF and directly callable backend requests independently validate the exact
  access token online with `getUser(accessToken)`;
- backend allowlists JWT algorithm, issuer and audience, validates expiry and
  `session_id`, handles key rotation, and fails closed without domain mutation
  on Auth unavailability;
- bootstrap and protected requests require `is_anonymous = false`, a verified
  email identity and only the P01-frozen email-OTP/TOTP `amr`/identity/provider
  combinations from fresh Auth evidence. Existing anonymous/password/OAuth/
  phone/recovery/linked identities and configuration drift deny; `amr` does not
  replace the code-only email-template check;
- `session.user`, user/app metadata and navigation state are never trusted;
- JWT lifetime, inactivity/absolute lifetime, concurrent-device and recent-
  reauthentication thresholds are frozen before implementation; refresh-token
  reuse detection remains enabled;
- backend maintains a private principal-scoped application-session registry
  keyed by verified `auth_user_id + session_id`; BFF login registers it, no raw
  token/OTP is stored, and an unknown, revoked or expired `session_id` is denied
  on every customer API/RPC even while a provider JWT has not yet expired;
- application state is
  `UNREGISTERED → BOOTSTRAP_PENDING → ACTIVE → REAUTH_REQUIRED | REVOKED |
  EXPIRED`; only fresh reauthentication returns `REAUTH_REQUIRED → ACTIVE`.
  Provider-session loss/reuse detection maps to terminal deny. A revoked/
  expired provider `session_id` can never bootstrap/reactivate; only a newly
  issued provider session may create a new row;
- database time owns inactivity/absolute expiry. Only an allowlisted versioned
  API/RPC transaction that completes both session and domain authorization may
  touch activity, after those checks and before commit. Assets, prefetch,
  polling configured as non-activity, denied/Auth-outage requests and the
  interim compatibility-view RLS guard do not touch `last_seen_at`. Touches
  are transactionally checked-before-update and coalesced at the P01-frozen
  interval so an expired session cannot be revived;
- customer session bootstrap is a private BFF→backend operation, absent from
  the customer OpenAPI/Data API. In addition to the exact bearer token it
  requires a short-lived one-time HMAC/JWS proof from the BFF, bound to issuer,
  audience, method/path, token digest, verified `sub`/`session_id`, pre-auth
  transaction, optional invitation selection, nonce, issued/expiry time,
  idempotency key and canonical request digest. `service_role`, Origin, CORS or
  an unsigned header is never accepted as that proof;
- proof consumption and the bootstrap receipt commit atomically. Same key/
  digest replays the receipt; replay with another key/digest, expired/unknown
  signing key, or an exact provider bearer without BFF proof performs zero
  invitation/membership/session mutation; only a bounded payload-free rejection
  security event is permitted;
- self-service active-session inventory exposes only bounded device/time labels.
  Revoking one/current/other/all marks the selected application sessions denied
  first; supported Supabase `local`/`others`/`global` sign-out follows through a
  durable reconciled effect. A provider-side access JWT remaining valid until
  `exp` never restores application authorization;
- mapping is fixed: `current → local`, `others → others`, `all → global`.
  Revoking one selected non-current session is application-only because the
  standard provider API has no arbitrary session-ID revocation; its provider
  effect is terminal `NOT_APPLICABLE`, not retryable. UI/audit distinguishes
  application revocation from provider reconciliation;
- provider sign-out response loss records `OUTCOME_UNKNOWN` after application
  denial commits. Reconciliation observes provider state before any bounded
  retry; without a provider-supported safe idempotency contract it escalates
  as a manual incident and never restores access;
- inventory hides expired tombstones after the retention window but preserves
  payload-free audit; cleanup cannot delete an active row or erase a pending
  provider-sign-out effect;
- membership disable, offboarding and factor revocation have executable
  immediate deny/recovery tests across BFF, API and direct-call paths;
- until EEM-8 replaces `api.trusted_knowledge`, its real REST/GraphQL customer
  path also requires an active application `session_id`; a direct provider-valid
  but unregistered/revoked token returns no rows, while explicitly separate
  machine/service access is preserved;
- first TOTP enrollment is the sole exception to prior full reauthentication:
  it begins from the freshly email-OTP-verified AAL1 session, grants no
  privileged capability until challenge/verify plus refreshed current/next AAL
  proves `aal2`, and abandoned/invalid enrollment stores no trusted factor.
  Later factor add/replace/unenroll and email changes require full recent
  reauthentication; successful change offers/forces termination of other
  sessions;
- “recent” is application-owned evidence, not a reusable claim inferred from
  `reauthenticate()`: a one-time challenge is bound to application session,
  exact action class, required fresh email-OTP plus TOTP methods, nonce,
  issued/expiry time and consumed version. Replay, different session/action,
  expiry or factor change invalidates `reauthenticated_at`;
- after factor enroll/unenroll/recovery, force token refresh and compare
  provider current/next AAL. A stale JWT that still says `aal2` cannot authorize:
  application session moves to `REAUTH_REQUIRED` until fresh permitted AAL
  evidence. Admin factor deletion first revokes all affected application
  sessions, then performs the global provider-session effect. Response loss is
  `RESET_OUTCOME_UNKNOWN`; reconciliation observes factor/session state before
  a bounded provider-supported idempotent retry and otherwise escalates without
  restoring access;
- no password reset exists in Alpha; claimant proof, separately authenticated
  AAL2 operator capability, approval/cooldown/notification, final-owner guard,
  session/factor revocation and payload-free audit are mandatory for
  compromised-email or lost-factor recovery.
- Evirion operator authentication has an executable headless Alpha path:
  B01A pre-provisions/bootstrap-controls the operator identity; B02 performs
  email-OTP, TOTP/AAL2, online token plus live platform-operator membership
  validation and dedicated operator-session bootstrap. OTP/TOTP input uses
  protected TTY/stdin, tokens remain process-memory only for one bounded
  command, and no token appears in argv, shell history, environment, repository
  file or logs. Lost-factor recovery requires another authorized AAL2 operator;
  EEM-7/02 consumes this path rather than inventing synthetic JWTs.
- the initial platform-operator roster comes only from an exact security-
  approved, two-person-approved, non-public deployment-owner bootstrap. It is
  idempotent/audited, creates passwordless unconfirmed identities without
  authorization metadata and is disabled after use. Later roster changes use
  a distinct approved deployment-owner command with final-active-operator
  guard; operator disable denies application sessions before provider
  reconciliation. Technical Design Partner Ready requires at least two
  distinct active operator identities.

#### AUTH-008 — Server-only BFF session and Auth UX

The browser talks only to same-origin BFF routes. Access and refresh tokens stay
in a request-local server session and host-only `__Host-` cookies with
`HttpOnly; Secure; SameSite=Lax; Path=/` and no `Domain`; browser JavaScript
does not initialize a session-bearing Supabase client.

Acceptance:

- invitation OTP is verified server-side, then the BFF clean-redirects with
  `303`; OTP/access/refresh/invite credentials never enter application URLs,
  local/session storage, client state, logs, analytics or third-party requests;
- after `verifyOtp`, the BFF calls an idempotent backend session bootstrap with
  the exact token and its one-time signed BFF proof. Existing active membership
  may register the session; exactly one matching live invitation may be
  selected automatically, while multiple eligible invitations require a
  post-auth explicit opaque selection. The selected invitation atomically
  registers the session and activates membership;
  mismatched/disabled/no-access state registers nothing. If bootstrap
  transiently fails after OTP consumption, tokens remain only in the host-only
  cookies and the BFF retries bootstrap without repeating OTP; all other API
  paths deny the still-unregistered `session_id`;
- the BFF refreshes and rotates session cookies server-side and performs online
  `getUser(accessToken)` before every protected backend call;
- concurrent refresh/lost-response tests prove one user/session cannot receive
  another session and refresh-token reuse recovery remains bounded;
- cookie serialization/chunking is deterministic; every chunk preserves the
  `__Host-` attributes, rotation/logout clears every old chunk, and session or
  response-header size above the frozen browser/proxy budget fails closed;
- unchunked+chunked collision, missing/gapped/duplicate/reordered/corrupt/
  mixed-generation/excess chunks, stale higher chunks and aggregate inbound
  `Cookie`/outbound deletion `Set-Cookie` overflow clear every bounded slot,
  deny, and perform no refresh/bootstrap/invitation/domain mutation;
- TOTP enrollment/challenge, AAL2 step-up, active-session inventory,
  one/other/all-session logout and recovery states have accessible positive,
  negative, expiry, replay and cross-user tests;
- first TOTP enrollment from fresh email-OTP AAL1 is tested separately from
  later add/replace/unenroll reauthentication, with no privileged action before
  refreshed current/next AAL proves `aal2`;
- TOTP enrollment QR/raw seed is explicitly one-time browser-visible
  privileged material. It is rendered only on a dynamic `private, no-store`
  response and never enters RSC/router cache, prefetch, analytics, logs, error
  capture, audit metadata or later navigation state;
- before a provider session exists, OTP request/verify/bootstrap-selection use
  a distinct short-lived pre-auth transaction in a host-only secure cookie and
  a signed double-submit proof bound to canonical host/origin, HMAC email
  identity, nonce, attempt generation and expiry. State is `ISSUED →
  OTP_REQUEST_STARTED → OTP_REQUESTED → OTP_VERIFY_STARTED → OTP_VERIFIED →
  BOOTSTRAP_PENDING → CONSUMED`, with request `OUTCOME_UNKNOWN`, verify
  `VERIFY_OUTCOME_UNKNOWN` and terminal `REVOKED | EXPIRED | FAILED` branches;
  login rotates it into the provider `session_id`-bound CSRF proof and clears
  all pre-auth state;
- a 256-bit HMAC-signed double-submit CSRF token is bound to live
  `session_id`; exact Origin/canonical Host, Fetch Metadata, content type and
  trusted-proxy rules cover Route Handlers and Server Actions;
- login-CSRF, session swapping, replay, parallel tabs, stale OTP generation,
  cross-site form, null/malformed Origin and direct form-post tests fail before
  Auth/bootstrap/domain effects;
- per-response CSPRNG CSP nonce is unique and header-bound; production CSP has
  no `unsafe-inline` or `unsafe-eval`;
- force-dynamic/no-store, zero authenticated hosting TTL and no module-scope
  client/user/tenant state prevent warm-instance and cross-tenant session leaks.

#### AUTH-009 — Auth configuration, abuse and release parity

Local configuration and the source-controlled expected hosted manifest allow
only email OTP plus TOTP MFA. Public signup, magic/Admin invitation links,
anonymous, password, phone, social/OAuth, SSO and manual identity linking are
disabled unless a later accepted threat-model amendment owns them.

Acceptance:

- local and hosted Auth settings are parity-tested, including disabled
  providers, signup and anonymous sign-in;
- OTP expiry/resend cooldown, per-IP/per-email quotas, generic anti-enumeration
  responses, CAPTCHA/risk equivalent, lockout recovery and alert thresholds are
  frozen and direct-Auth-endpoint tested;
- the Console-specific ASVS v5 Level 2 matrix assigns each applicable V1, V3,
  V4, V6–V10 and V12–V16 row to an owner/evidence/environment/verifier;
- V10.1.1 is satisfied by the server-only `HttpOnly` BFF token boundary;
- baseline plus separately authorized authenticated DAST, manual security
  charter and independent full-platform pentest/retest evidence including
  Console/BFF/Auth gate Technical Design Partner Ready.

### 11.2 GitHub connection

#### GH-001 — Connect existing GitHub App

Owner/Admin запускает installation flow существующего Evirion GitHub App.

Acceptance:

- signed state связывает user, organization, nonce и expiry;
- callback отклоняет missing, expired, reused или mismatched state;
- installation ID повторно разрешается server-side;
- browser не получает App private key или installation token;
- successful binding audit-logged.

#### GH-002 — Existing installation detection

Onboarding определяет уже связанную active installation. Alpha поддерживает
ровно одну effective active GitHub installation на Organization; previous
installations сохраняются как history.

Acceptance:

- повторный onboarding не создаёт duplicate installation;
- installation другого tenant нельзя привязать подменой ID;
- suspended/removed installation отображается и блокирует новые source work.
- reconnect не оставляет две effective active installations.

#### GH-003 — Accessible repository synchronization

Backend запускает asynchronous generation-based synchronization доступной
repository metadata.

Acceptance:

- start endpoint возвращает sync receipt, а status endpoint — progress/result;
- GitHub traversal cursor-paginated и имеет bounded page/total watchdog;
- unseen repositories помечаются inaccessible только после complete successful
  traversal;
- failed/partial sync не изменяет access status unseen repositories;
- repository хранит access status, last seen generation и last successful
  sync timestamp;
- all-repositories installation не запускает processing;
- repository metadata не считается entitlement;
- inaccessible/removed repository корректно помечается;
- токены и private GitHub payload не сохраняются в Console.

#### GH-004 — Installation lifecycle freshness

Signed `installation` и `installation_repositories` lifecycle events обновляют
только control-plane access state и никогда не создают extraction work.

Acceptance:

- suspended/removed immediately blocks new token/source authorization;
- source claim additionally performs current access verification within
  documented freshness window;
- stored Source Envelope may finish already-authorized deterministic
  processing only under entitlement/paid rules;
- stale access state fails closed;
- lifecycle event idempotent and payload-minimized.

### 11.3 Repository entitlement

#### ENT-001 — Distinct entitlement

Каждый processing-enabled repository имеет отдельный entitlement.

Минимальные поля:

```text
id
organization_id
repository_id
status: ACTIVE | DISABLED
source: DESIGN_PARTNER | PLAN | MANUAL
granted_at
granted_by
revoked_at
revoked_by
created_at
```

Acceptance:

- GitHub-accessible repository может оставаться locked;
- policy не заменяет entitlement;
- one effective entitlement per organization/repository;
- RLS forced;
- tenant-aware FK;
- customer actor references active membership in the same organization;
- operator actor references trusted platform principal;
- actor kind and actor ID are mutually consistent;
- authenticated role не получает direct base-table write.

#### ENT-002 — Organization repository limit

Organization имеет explicitly provisioned `limit_mode`, capacity и
`replacement_mode`.

Acceptance:

- missing limit row возвращает `ORGANIZATION_LIMIT_NOT_PROVISIONED`;
- `limit_mode = FIXED` требует positive `max_active_repositories`;
- `limit_mode = UNLIMITED` требует null capacity и может быть установлен только
  trusted operator;
- `replacement_mode = OPERATOR_ONLY` является default для limited Alpha;
- concurrent activation при одном slot активирует максимум один repository;
- limit проверяется server-side;
- limit change audit-logged;
- counting использует только effective `ACTIVE` entitlements.

#### ENT-003 — Idempotent activation

Owner/Admin активирует repository одной transaction.

Acceptance:

- проверены membership, capability, tenant, installation access и limit;
- duplicate request возвращает existing active receipt;
- no partial entitlement/audit state;
- repository другого tenant возвращает tenant-obscured `404`;
- stale UI state не обходит limit.

#### ENT-004 — Controlled disable

Для unlimited/manual organization Owner/Admin может отключить entitlement,
если policy это разрешает. Для repository-limited Alpha Owner/Admin создаёт
request на change/disable, а Evirion Operator выполняет audited transition.

Acceptance:

- новые webhook/backfill/source/provider actions блокируются;
- historical provenance не удаляется;
- pre-authorization work получает stale-generation non-retryable/paused
  outcome и не оживает после reactivation;
- committed, unexpired per-call authorization может dispatch ровно свой
  logical request и только captured bounded transport retries;
- authorized but expired/undispatched work не dispatch-ится;
- entitlement disable не создаёт новую authorization; unknown-outcome retry
  переиспользует existing authorization по BR-006;
- operational revoke blocks every not-yet-started dispatch/retry;
- checkpointed response завершается без нового provider call;
- reason и actor audit-logged;
- repeated disable idempotent.

#### ENT-005 — Anti-rotation

Repository replacement не позволяет бесплатно обработать неограниченное число
repositories.

Acceptance:

- historical usage остаётся после disable;
- previously processed PR не становится unprocessed;
- Alpha UI не предлагает unrestricted immediate replacement;
- limited Alpha возвращает `REPOSITORY_REPLACEMENT_REQUIRES_OPERATOR`;
- operator replacement атомарно отключает old и активирует approved new
  repository;
- admin self-service replacement разрешается только explicit organization
  policy;
- pricing logic не встраивается в extraction provenance.

#### ENT-006 — Entitlement source ownership

Source values:

| Source | Who may set | Alpha meaning |
|---|---|---|
| `DESIGN_PARTNER` | server derives from operator-provisioned organization program | customer-selected first repository consumes an approved Alpha slot |
| `PLAN` | future billing/plan service only | reserved; not customer-set in Alpha |
| `MANUAL` | Evirion operator with reason | incident/migration exception |

Acceptance:

- Owner/Admin cannot select or change source;
- Evirion Operator provisions organization program, limit and slots before
  first activation; it does not need to pre-approve one repository ID;
- first Owner/Admin activation may select any currently GitHub-accessible
  repository, and backend derives `DESIGN_PARTNER` from that program;
- source changes do not erase prior events;
- reserved `PLAN` cannot be used before billing authority exists;
- source never substitutes for ACTIVE status, capacity or processing policy.

### 11.4 Repository management

#### REPO-001 — Accessible versus active

Repository list явно разделяет:

- GitHub Access;
- Evirion Entitlement;
- Live Processing Policy;
- repository-change request.

Acceptance:

- `Available` не выглядит как `Active`;
- locked repository не имеет Import action;
- counts GitHub-accessible и Evirion-active показываются отдельно;
- refresh отражает committed backend state.

Canonical product states:

| GitHub access | Entitlement | Live policy | Product state | Main action |
|---|---|---|---|---|
| absent/removed | any | any | `INACCESSIBLE` | reconnect/fix access |
| accessible | absent | n/a | `AVAILABLE_LOCKED` | activate/request slot |
| accessible | disabled | any | `ENTITLEMENT_DISABLED` | request reactivation/change |
| accessible | active | `OFF` | `ACTIVE_LIVE_OFF` | prepare import/change policy |
| accessible | active | `SOURCE_ONLY` | `ACTIVE_SOURCE_ONLY` | view source preparation/change policy |
| accessible | active | `AUTO_EXTRACT` | `ACTIVE_AUTO_EXTRACT` | monitor |
| accessible | active | any + change request | `CHANGE_REQUESTED` | await operator |

Archived repositories additionally display `ARCHIVED`; they do not silently
map to locked/active.

#### REPO-002 — Repository activation confirmation

Перед activation UI объясняет последствия.

Минимальный текст:

```text
Evirion will be allowed to:
- process future merged pull requests;
- prepare historical pull requests;
- run approved model extraction;
- retain usage for this repository.
```

Acceptance:

- explicit confirmation required;
- button disabled during request, но backend idempotency остаётся authority;
- conflict показывает актуальный limit без optimistic false success;
- audit receipt доступен после success.

#### REPO-003 — Repository overview

Overview разделяет Processing и Engineering Memory.

Processing:

- merged PR discovered;
- Source Envelopes prepared;
- awaiting approval;
- processing;
- completed runs;
- rejected runs;
- quarantined runs;
- failed jobs.

Engineering Memory:

- admitted Knowledge Objects;
- awaiting review;
- approved;
- edited;
- user rejected;
- unresolved;
- active;
- superseded.

Acceptance:

- counts tenant/repository-scoped;
- REJECTED/QUARANTINED не входят в KO count;
- query не использует per-row N+1;
- pagination/aggregation имеют documented performance bound.

#### REPO-004 — Repository processing policy

Owner/Admin может изменять только customer-safe поля существующей
`repository_automation_policies`; entitlement остаётся отдельным gate.

Alpha allowlist:

- live processing mode:
  - `OFF`: future live merge creates no job or Source Envelope;
  - `SOURCE_ONLY`: creates source work but never automatically authorizes a
    provider call;
  - `AUTO_EXTRACT`: permits paid authorization only when every other gate is
    satisfied;
- bounded repository budget, если organization policy разрешает customer
  adjustment;
- documented processing mode values.

Acceptance:

- policy mutation требует capability, expected version и idempotency key;
- disabling live policy не освобождает entitlement slot;
- policy не может разрешить processing без ACTIVE entitlement;
- selecting `AUTO_EXTRACT` creates/replaces a durable customer consent scoped
  to repository, entitlement generation, policy version, model/profile
  allowlist, call/budget ceiling, retry policy and expiry;
- `AUTO_EXTRACT` without complete consent remains fail-closed;
- changing to `OFF`/`SOURCE_ONLY` revokes future dispatch under the prior
  consent without deleting its history;
- customer consent never creates Evirion operational authorization;
- Alpha has no “approve this live Source Envelope later” action; changing
  future behavior requires a versioned policy update, while historical work
  uses the guarded import workflow;
- unknown/internal policy fields не принимаются и не возвращаются;
- direct base-table write запрещён;
- audit содержит old/new bounded values без secrets.

Mapping to the existing policy is explicit and versioned:

```text
enabled = false                               -> OFF
enabled = true, auto_extract_merged_prs=false -> SOURCE_ONLY
enabled = true, auto_extract_merged_prs=true  -> AUTO_EXTRACT
```

No UI label may claim “live off” while webhook/source work still occurs.

### 11.5 Historical import

#### BF-001 — Prepare import

Owner/Admin выбирает:

- entire repository history;
- last 12 months;
- custom date range.

CTA: `Prepare import`.

Console всегда создаёт customer import в backend mode `missing_only`.
`reextract` остаётся operator-only и требует отдельной purpose, paid approval
и plan.

Acceptance:

- requires ACTIVE entitlement;
- invokes existing backfill create/discover workflow;
- duplicate click не создаёт second run;
- free stages не требуют provider approval;
- refresh/reopen восстанавливает current run.
- caller cannot inject `reextract` through direct request.

#### BF-002 — Real backend status mapping

Console отображает existing states:

| Backend | User-facing label |
|---|---|
| `planning` | Preparing import |
| `discovering` | Discovering PR history |
| `paused` | Import paused |
| `awaiting_approval` | Ready for extraction |
| `processing` | Extracting Engineering Memory |
| `completed` | Import complete |
| `failed` | Import failed |
| `cancelled` | Import cancelled |

Неизвестный backend state fail-closed и не отображается как success.

Backend additionally projects, without changing `BackfillRun.status`:

```text
paidAuthorizationStatus:
  NOT_REQUIRED
  AWAITING_CUSTOMER_CONSENT
  AWAITING_OPERATIONAL_AUTHORIZATION
  AUTHORIZED
  EXPIRED
  REVOKED
```

If customer consent exists but operational authorization is
missing/expired/revoked, the primary UI label is
`Waiting for Evirion authorization`, never `Extracting Engineering Memory`.
Customer may view status/contact support but cannot self-authorize. A fresh
operator authorization resumes the existing idempotent workload while consent,
entitlement, policy and budget remain valid.

#### BF-003 — Paid approval

На `awaiting_approval` Owner/Admin видит:

- repository;
- number of eligible PR;
- already processed count;
- prepared Source Envelope count;
- known budget/limit;
- explicit paid-model warning.

Acceptance:

- approval требует active entitlement и capability;
- uses existing backend transition;
- no second model queue on retry;
- direct RPC without confirmation/capability denied;
- knowledge worker cannot claim paid work before approval.
- customer approval without active operational authorization derives
  `AWAITING_OPERATIONAL_AUTHORIZATION` and zero provider dispatch;
- operational expiry/revoke never fabricates failure/completion and requires a
  fresh operator authorization before dispatch.

#### BF-004 — Progress

Processing view показывает:

- processed / total;
- accepted;
- rejected;
- quarantined;
- failed;
- cost amount plus `RESERVED | MEASURED | UNRESOLVED | NOT_APPLICABLE`.

Acceptance:

- counts derive from backend;
- active canonical/deduplicated jobs не считаются terminal prematurely;
- reload не теряет progress;
- late failures корректируют aggregate;
- no UI-only cancellation.
- unresolved/reserved cost never appears as measured zero.

### 11.6 Engineering Memory queue

#### MEM-001 — Queue contains admitted knowledge only

Acceptance:

- only Knowledge Objects from valid `ACCEPTED` admission;
- machine REJECTED/QUARANTINED absent;
- default filter is human review `PENDING`;
- user-rejected objects remain available in dedicated tab/history;
- superseded objects are available through explicit filter/history.

#### MEM-002 — Filters and pagination

Filters:

- repository;
- knowledge type;
- human review status;
- lifecycle;
- PR merged-at range in UTC;
- pull request;
- PR author login.

Acceptance:

- cursor pagination;
- stable ordering;
- filter state shareable without embedding secrets;
- all predicates tenant-scoped;
- large tenant query has measured plan before release.

#### MEM-003 — Queue row

Показывает:

- short claim;
- knowledge type;
- PR number/title;
- merged date;
- confidence;
- review status;
- lifecycle;
- `Open`.

Полный provenance не загружается для каждого row.

### 11.7 Knowledge detail and evidence

#### KD-001 — Original knowledge

Detail отображает canonical machine-extracted fields, которые реально
существуют и заполнены.

Acceptance:

- no invented empty sections;
- original payload доступен независимо от human edit;
- schema/version indicated in Technical Details;
- effective edited view явно помечен как human-edited.

#### KD-002 — Exact evidence

Для каждого evidence:

- exact quote;
- source type;
- source author;
- source location;
- safe GitHub link, если он однозначно восстанавливается.

Acceptance:

- quote byte/content matches persisted evidence;
- source attribution видна до review action;
- URL host/repository/path server-generated or allowlisted;
- customer не получает raw Source Envelope целиком по умолчанию.

#### KD-003 — Source context

Показываются:

- PR number;
- title;
- author;
- merged date;
- GitHub link.

Cross-tenant or guessed ID не раскрывает существование объекта.

#### KD-004 — Technical details

Collapsed section может показывать customer-safe:

- Extraction Run ID;
- admission;
- model ID;
- semantic specification/pipeline version;
- extracted timestamp;
- aggregate token usage;
- cost amount and completeness status;
- latency.

Raw model response, credentials и internal stack traces не показываются.

### 11.8 Human review

#### REV-001 — Immutable approve

Approve создаёт immutable review record, который явно подтверждает original
machine payload и сохраняет его canonical hash.

Acceptance:

- reviewer ID derived from auth context;
- timestamp database-owned;
- organization/knowledge tenant match enforced;
- approved payload source/hash recorded;
- duplicate idempotency key returns same receipt;
- AdmissionRecord unchanged;
- audit event emitted.

#### REV-002 — Immutable edit

Edit сохраняет full **editable projection**, его schema version/hash,
canonical payload hash и note.

Editable fields v1:

```text
knowledgeType
problem
knowledge
designRationale
documentedTradeoffs
explicitAlternatives
constraints
invariants
failureModes
affectedSystems
futureImpact
answerableQuestions
implementationStatus
```

Never editable:

```text
evidence and evidenceBasis
source/author/dates/code anchors
model/admission/run identifiers
confidence/importance/priority scoring
knowledgeStatus
lifecycle/relation fields
```

Acceptance:

- original Knowledge Object unchanged;
- edited payload проходит versioned dedicated schema validation with bounded
  strings/arrays;
- edit persists `editSchemaVersion`, schema SHA-256 and payload SHA-256;
- evidence remains original machine evidence and UI labels that human-edited
  claims were not re-extracted;
- previous review history remains queryable;
- effective view deterministically selects latest committed review sequence;
- stale expected revision returns `409`;
- credentials/secrets are rejected from note/payload fields where applicable.

#### REV-003 — User reject

Reject требует structured reason:

- `INCORRECT`;
- `NOT_DURABLE`;
- `UNSUPPORTED`;
- `TOO_VAGUE`;
- `DUPLICATE`;
- `OUTDATED`;
- `OTHER`.

Edit/Reject также записывает issue severity:

```text
NONE | MINOR | MAJOR | CRITICAL
```

Acceptance:

- `OTHER` requires bounded note;
- `NONE` допустим только для non-quality reasons such as duplicate/outdated;
- original knowledge/provenance remains;
- object removed from reviewed-active projection, но остаётся в history;
- reason metrics update without exposing note content;
- decision may be superseded only by another audited review action.

#### REV-005 — Review/lifecycle combination matrix

Allowed current combinations:

| Human review | Lifecycle |
|---|---|
| `PENDING` | `UNRESOLVED` |
| `APPROVED` | `UNRESOLVED`, `ACTIVE`, `SUPERSEDED` |
| `EDITED` | `UNRESOLVED`, `ACTIVE`, `SUPERSEDED` |
| `USER_REJECTED` | `UNRESOLVED` |

Rules:

- `EDITED` is already a completed human decision; no generic
  `edited → approved` action exists;
- reverting an edit is an explicit `REVERT_TO_ORIGINAL_AND_APPROVE` action
  that records original payload hash and does not silently discard the edit;
- every review mutation carries/rechecks expected review sequence and expected
  lifecycle version;
- lifecycle mutation requires current `APPROVED` or `EDITED`;
- rejecting ACTIVE/SUPERSEDED knowledge uses a separately designed
  correction/withdraw workflow, not normal Reject;
- reviewed-active projection contains only `APPROVED|EDITED + ACTIVE`;
- current `api.trusted_knowledge` machine-admission semantics remain unchanged.

#### REV-004 — Optimistic concurrency

Review mutation carries expected current review sequence and expected
lifecycle version.

Acceptance:

- two reviewers cannot silently overwrite decisions;
- one succeeds, stale request receives current state in bounded conflict
  response;
- retry with same idempotency key is safe;
- no partial review/audit row.

### 11.9 Lifecycle and supersession

#### LIFE-001 — Derived unresolved

No lifecycle event means `UNRESOLVED`.

Acceptance:

- historical backfill objects default unresolved;
- no mass auto-activation;
- projection remains deterministic;
- no extra mutable current-state table required.

#### LIFE-002 — Mark active

Reviewer+ capability inserts immutable `active` state event.

Acceptance:

- tenant/capability checked;
- expected review sequence and lifecycle version checked;
- current review is APPROVED or EDITED;
- database persists canonical reason code `REVIEWER_CONFIRMED_CURRENT` plus
  optional bounded note;
- duplicate action idempotent;
- review state unchanged;
- audit event emitted.

#### LIFE-003 — Mark superseded

Reviewer выбирает newer Knowledge Object.

Acceptance:

- source/new and target/old differ;
- both belong to same organization;
- both are admitted Knowledge Objects;
- both are currently APPROVED or EDITED;
- both expected review sequences and lifecycle versions match under lock;
- relation direction is `new SUPERSEDES old`;
- old receives `superseded` event in same transaction;
- relation/state records use canonical reason
  `REPLACED_BY_NEWER_KNOWLEDGE` plus optional bounded note;
- new does not auto-activate;
- cycle/duplicate relation rejected;
- graph mutation serialized per organization; traversal bound exhaustion fails
  closed without mutation;
- cross-tenant selection impossible.

#### LIFE-004 — Withdrawn is internal

Existing `withdrawn` state remains available для approved admin/operator
workflows, но не является Alpha reviewer action.

#### LIFE-005 — Correct an erroneous supersession

Reviewer может request correction; Evirion Operator выполняет compensating,
append-only workflow.

Request types:

```text
RETRACT_SUPERSESSION
WITHDRAW_ACTIVE_KNOWLEDGE
RESTORE_UNRESOLVED
```

Request states:

```text
REQUESTED -> EXECUTING -> EXECUTED
REQUESTED -> REJECTED
EXECUTING -> FAILED -> EXECUTING
```

Acceptance:

- request rechecks expected review, lifecycle and nullable relation versions;
- original relation/event never deleted;
- relation receives append-only `RETRACTED` state event with reason/actor;
- old object receives explicit `UNRESOLVED` or `ACTIVE` compensating lifecycle
  event selected by operator;
- relation-state event and lifecycle compensation commit atomically;
- reviewed-active projection ignores retracted relation;
- concurrent correction/supersession serialized per organization;
- operator execution/rejection is derived from authenticated platform identity;
- same command replay returns same receipt; failed execution is resumable
  without duplicate state event;
- active-knowledge withdrawal appends existing internal `withdrawn` event and
  never rewrites review/admission;
- customer UI shows request status, bounded reason and complete history but no
  operator-only action.

### 11.10 Pull request detail

#### PR-001 — Customer-safe PR projection

Показывает:

- PR number/title/author/merged date;
- safe GitHub URL;
- merge/head SHA where useful;
- source preparation status;
- extraction status;
- admitted Knowledge Objects;
- referenced PR/issues summary;
- processing/admission status.

Acceptance:

- persisted source/provenance used;
- REJECTED shows reason, not fake KO;
- QUARANTINED shows bounded validation categories;
- raw private payload not exposed;
- cross-tenant URL/ID tampering denied.

### 11.11 Processing Activity

#### PROC-001 — Separate operational view

Rows:

- repository;
- PR;
- job status;
- source status;
- admission;
- attempts;
- paid authorization status;
- cost amount and completeness status;
- latency;
- updated timestamp.

Acceptance:

- backend states used directly through a versioned mapping;
- REJECTED not shown as infrastructure failure;
- QUARANTINED distinct from provider/network failure;
- payload-free stable error code translated to user-safe copy;
- missing/expired/revoked operational authorization is rendered as
  `Waiting for Evirion authorization`, not extracting/failed/retryable;
- pagination and tenant filters enforced.

#### PROC-002 — Retry capability

Retry action видна только если backend response explicitly declares retry
capability.

Acceptance:

- frontend never classifies retryability itself;
- checkpointed job does not make second provider call;
- non-retryable entitlement/contract errors have no Retry CTA;
- operation idempotent and audited;
- Alpha excludes unrestricted replay/DLQ controls.

#### PROC-003 — Validation issues

Admin может увидеть bounded issue code/path/message, необходимый для support.

Acceptance:

- no raw model response;
- no source payload;
- no secret-bearing stack trace;
- customer-safe field allowlist;
- tenant-scoped.

### 11.12 Minimal settings and usage

#### SET-001 — Members

Показывает active/invited members, email/name, UI role и status.

Alpha actions:

- invite Reviewer/Viewer;
- resend or revoke pending invitation;
- owner-only role elevation to Admin;
- disable membership.

Acceptance:

- no self-removal of final owner;
- invite tenant-bound;
- role changes live-authorized;
- audit emitted.

#### SET-002 — GitHub

Показывает:

- GitHub account/organization;
- installation status;
- accessible repository count;
- active Evirion repository count;
- last successful sync.

Никаких токенов или secret diagnostics.

#### SET-003 — Usage

До authoritative billing показывает operational usage:

- active repositories;
- historical PR processed;
- live PR processed in period;
- provider/model cost;
- accepted Knowledge Objects.

Acceptance:

- clearly labelled operational, not invoice;
- tenant-scoped;
- deactivation не уменьшает historical usage;
- cost derived from existing immutable attempt/run records;
- period/timezone documented.

### 11.13 Platform paid-operation control

#### OPS-001 — Durable operator authorization

Перед любым real provider workload authenticated Evirion Operator создаёт
отдельную operational authorization через non-browser control plane.

Acceptance:

- customer consent и chat approval сами не создают authorization;
- operator principal derived, not supplied by request;
- authorization фиксирует environment, organization/repository or import,
  model profile, phases, attempt/call ceilings, budget, retry policy,
  entitlement generation и expiry;
- create/revoke idempotent and audit-logged;
- revoke/expiry блокирует undispatched provider calls;
- dispatched/checkpointed history не удаляется и не переписывается;
- customer role и browser session не могут list/create/revoke authorizations;
- bounded list/status не раскрывает provider secret или customer payload;
- missing authorization is `PAID_OPERATION_NOT_AUTHORIZED`.

#### OPS-002 — Durable partner offboarding

Owner may request offboarding; only authenticated Evirion Operator executes
the organization-wide control workflow.

```text
REQUESTED -> EXECUTING -> COMPLETED
REQUESTED -> REJECTED
EXECUTING -> FAILED -> EXECUTING
```

Acceptance:

- new invitations disabled and pending invitations revoked;
- memberships disabled under organization guard; stale JWT loses backend
  access immediately;
- target-organization membership denial is immediate. Principal application/
  provider sessions remain usable for another active organization; global Auth
  revocation occurs only when no active membership remains or a separately
  authorized security incident requires it. Any required Auth revocation and
  GitHub unbind are durable reconciled effects;
- entitlements disabled/generation-incremented, policies/consents revoked and
  every operational authorization revoked;
- workers/queues cannot start new source/provider work;
- checkpointed responses follow BR-007; provenance/history/usage remain under
  retention;
- same command replay is idempotent; partial failure resumes without repeating
  completed effects;
- actor, reason, affected counts and bounded failure status audit-logged;
- no customer/browser endpoint can execute offboarding directly.

### 11.14 Alpha metrics

#### MET-001 — Review metrics

Автоматически рассчитываются:

```text
reviewed_count
approved_without_edit_count
edited_count
user_rejected_count
approval_without_edit_rate
edit_rate
user_rejection_rate
```

#### MET-002 — Lifecycle metrics

```text
active_count
superseded_count
unresolved_count
lifecycle_resolution_rate
```

#### MET-003 — Admission and cost metrics

```text
accepted_runs
rejected_runs
quarantined_runs
failed_jobs
cost_per_pr
cost_per_accepted_knowledge_object
latency_per_pr
```

Acceptance for all metrics:

- numerator/denominator defined;
- time window explicit;
- no cross-tenant customer aggregation;
- machine admission and human review not mixed;
- divide-by-zero returns null/not-applicable, not misleading zero;
- calculations reproducible without manual spreadsheet.

## 12. Primary user journeys

### J-001 — Accept invite and sign in

Preconditions:

- Organization exists;
- active Owner/Admin created invitation;
- email delivery available.

Main flow:

1. User opens the clean Console sign-in URL; email contains no invitation/Auth
   credential-bearing link.
2. User requests and enters the email OTP through the pre-auth BFF flow.
3. Backend validates the exact Auth token and one-time BFF bootstrap proof.
4. If the verified user has no active membership and exactly one eligible live
   invitation, bootstrap selects it. If multiple invitations are eligible, BFF
   renders only post-auth bounded organization labels plus opaque invitation
   IDs and requires explicit selection; zero eligible invitations denies.
5. Under rank-1 locks, backend rechecks selected invitation, verified user/
   email, expiry/revocation and membership, then atomically registers the
   application session and activates membership/invitation.
6. Console loads organization context and capabilities.
7. New Admin is sent to onboarding; Reviewer/Viewer is sent to repository or
   memory view.

Alternate/error flows:

- expired invite → safe reissue request;
- revoked invite → generic unavailable state;
- existing active member → idempotent sign-in;
- disabled member → access denied;
- wrong signed-in email → no activation.
- concurrent revoke/expire/accept or stale opaque selection → no session or
  membership mutation;
- multiple invitations never auto-select by iteration/order and no
  organization label is exposed before email verification.

Postconditions:

- the selected membership is active exactly once; unrelated existing
  memberships are unchanged;
- audit receipt;
- no GitHub or processing side effect.

### J-002 — Connect GitHub and discover repositories

Preconditions:

- active Owner/Admin;
- organization has no usable installation or user explicitly reconnects.

Main flow:

1. Console requests signed installation state.
2. User is redirected to GitHub App installation.
3. GitHub redirects to backend control-plane callback.
4. Backend validates state and resolves installation/account.
5. Backend binds installation to Organization.
6. Backend synchronizes accessible repository metadata.
7. Console shows accessible repositories as `Locked`.

Postconditions:

- installation identity stored;
- no entitlement auto-created;
- no backfill, job, Source Envelope or provider call;
- audit receipt.

### J-003 — Activate one repository

Preconditions:

- Owner/Admin;
- active GitHub installation;
- repository still accessible;
- active slot available.

Main flow:

1. Admin opens activation confirmation.
2. Console sends expected organization/repository and idempotency key.
3. Backend rechecks membership, installation access and limit under lock.
4. Backend creates/activates entitlement and audit event atomically.
5. Console refreshes repository projection.

Conflicts:

- another request consumed last slot → `409 REPOSITORY_LIMIT_REACHED`;
- repository access removed → `409 REPOSITORY_ACCESS_CHANGED`;
- duplicate request → existing success receipt.

Postconditions:

- exactly one ACTIVE entitlement;
- no extraction starts merely from activation.

### J-004 — Prepare and approve historical import

Preconditions:

- Owner/Admin;
- ACTIVE entitlement;
- policy permits history preparation.

Main flow:

1. Admin chooses range and clicks `Prepare import`.
2. Existing backfill performs discovery and Source Envelope preparation.
3. Console polls/subscribes to backend projection.
4. Run reaches `awaiting_approval`.
5. Console displays workload and known budget.
6. Admin confirms `Approve extraction`.
7. Backend rechecks entitlement, policy, budget and approval capability.
8. Until Evirion operational authorization exists, Console shows
   `Waiting for Evirion authorization` and zero provider dispatch.
9. Backend rechecks all gates and Knowledge queue work begins.
10. Console displays progress and outcomes.

Error flows:

- entitlement disabled before approval → approval denied;
- duplicate approval → existing receipt;
- operational authorization missing/expired/revoked → existing run waits;
  customer cannot self-authorize or Retry;
- provider response checkpointed, затем entitlement disabled → deterministic
  completion without new provider call;
- free-stage failure → processing incident, no paid call.

### J-005 — Review a Knowledge Object

Preconditions:

- active member with review capability;
- object belongs to organization;
- object came from accepted admission.
- available actions are derived from current review and lifecycle versions;
- normal Reject is available only while effective lifecycle is UNRESOLVED.

Main flow:

1. Reviewer opens detail.
2. Console shows original claim, classification, source and exact evidence.
3. Reviewer chooses only an action allowed by the REV-005 matrix.
4. Mutation carries idempotency key, expected review sequence and expected
   lifecycle version.
5. Backend validates tenant/capability/state.
6. Backend appends review and audit records atomically.
7. Effective projection updates.

Conflict:

- another reviewer acted first → `409 REVIEW_VERSION_CONFLICT`; UI shows
  current state and asks user to reconsider.
- lifecycle changed to ACTIVE/SUPERSEDED → normal Reject is unavailable and UI
  routes the user to a correction request;
- stale lifecycle/review version returns bounded conflict with no review row.

### J-006 — Supersede old knowledge

Preconditions:

- review capability;
- old and new objects belong to same organization;
- both admitted.
- both latest review decisions are APPROVED or EDITED;
- old effective lifecycle is UNRESOLVED or ACTIVE; neither object is already
  terminal SUPERSEDED for this action.

Main flow:

1. Reviewer opens old object.
2. Chooses `Mark superseded`.
3. Searches/selects newer object.
4. Console displays relation direction and confirmation.
5. Mutation carries both objects’ expected review sequences and lifecycle
   versions plus idempotency key.
6. Backend locks/rechecks both objects.
7. Backend inserts `new -> supersedes -> old` relation and old
   `superseded` event atomically.
8. Old object appears as superseded; new stays unresolved unless separately
   activated.

Conflict/error:

- stale review/lifecycle version → no relation/event and current bounded state;
- either object no longer APPROVED/EDITED → action unavailable;
- erroneous existing supersession → customer submits LIFE-005 correction
  request; normal action never rewrites/deletes history.

### J-007 — Investigate processing outcome

Preconditions:

- member has processing-view capability.

Main flow:

1. User opens Processing Activity.
2. Filters repository/PR/status.
3. Opens row.
4. Console shows job/run/admission summary and bounded error/validation data.
5. Retry action appears only when backend advertises it.

Postconditions:

- view has no processing side effect;
- raw source/model payload remains protected.

### J-008 — Manage members without losing ownership

1. Owner/Admin opens Members.
2. Invites Reviewer/Viewer or requests role change.
3. Backend locks organization membership guard and rechecks live roles.
4. Invite/change writes command receipt and durable workflow/audit.
5. Concurrent demotion/removal cannot leave zero active Owners.

Failure/recovery:

- email delivery failure remains resumable;
- revoked/expired invite cannot activate;
- Admin cannot create/promote Owner;
- final Owner transfer requires explicit new Owner acceptance before old Owner
  can leave.

### J-009 — Reconnect, suspend or remove GitHub installation

1. Owner/Admin sees stale/suspended/removed status.
2. Reconnect creates a new one-time setup intent.
3. Successful callback atomically selects one effective installation.
4. Asynchronous sync reaches complete generation before access tombstones.
5. Removed/suspended installation blocks new source authorization immediately.

No entitlement or provenance is deleted. Reconnect does not auto-replay
ignored events.

### J-010 — Recover paused/failed import or processing

1. User opens failure detail.
2. Backend projection supplies stable error and explicit capability:
   `NONE | RETRY | RESUME | CONTACT_SUPPORT`.
3. UI exposes only that action.
4. Retry/resume uses durable idempotency receipt and current
   entitlement/policy/approval checks.
5. Checkpoint reuse occurs before any new provider authorization.

Unknown/unsafe state has no retry CTA.

### J-011 — Offboard a design partner

1. Owner submits bounded offboarding request or Operator creates it directly.
2. Operator executes the durable OPS-002 workflow.
3. Invitations/memberships, repository entitlements, policies, customer
   consents and paid operational authorizations are disabled/revoked.
4. GitHub unbind and any conditionally required Auth revocation reconcile from
   durable checkpoints; multi-organization users retain unrelated access.
5. New work stops; checkpointed responses follow BR-007.
6. Historical data remains under configured retention/legal policy.
7. Export/erasure, when required, uses the existing separately approved
   retention/erasure runbook; Console Alpha does not invent an ad-hoc delete.
8. Audit records the offboarding boundary without raw payload.

## 13. Error contract

Customer-facing APIs use stable machine codes plus bounded safe messages.

| HTTP | Meaning | Required behavior |
|---|---|---|
| `401` | Missing/invalid session | Sign-in required; no resource detail |
| `403` | Active member lacks capability | No state mutation |
| `404` | Resource absent or tenant-obscured | Same response for foreign tenant |
| `409` | Limit, stale version, concurrent or state conflict | Return safe current version/next action |
| `422` | Structurally valid request violates transition/input rule | Field/code details without internals |
| `429` | Bounded rate limit | Retry-After where safe |
| `503` | Retryable dependency unavailable | No false success; bounded correlation ID |

Unknown backend state/error:

- never mapped to success;
- UI uses safe generic copy;
- correlation ID available;
- sensitive database/provider details remain server-side.

## 14. Non-functional requirements

### NFR-SEC-001 — Browser secret boundary

Browser bundle and payload contain no:

- service-role key;
- GitHub App private key;
- installation token;
- worker DSN;
- provider key;
- raw model response;
- unrestricted source payload.

### NFR-SEC-002 — Defense in depth

Authorization uses:

1. purpose-built API surface;
2. SQL grants;
3. forced RLS on every new Console-owned tenant table;
4. tenant-aware foreign keys;
5. capability checks;
6. audit.

Existing `organization_memberships` has a documented non-FORCE-RLS exception
to avoid recursive membership lookup. Its owner/runtime non-bypass, grants and
security-definer helper require explicit regression tests. Obsolete direct
authenticated reads of `core` tables are revoked after customer-safe APIs are
available; `api.trusted_knowledge` keeps its existing machine-trusted semantics
only until EEM-8/03 migrates supported consumers. Before EEM-9/10, accepted but
`UNRESOLVED` objects must be absent from every active/trusted projection.

### NFR-SEC-003 — Web security

Console must implement:

- server-only Supabase Auth session handling with
  host-scoped `__Host-` access/refresh cookies using `HttpOnly; Secure;
  SameSite=Lax; Path=/` and no `Domain`, request-local clients and online
  `getUser(accessToken)` verification in both BFF and backend;
- canonical local/staging/production origins and trusted-proxy/TLS policy;
  local browser/E2E and DAST harnesses preserve the production `__Host-`/
  `Secure` contract over a pinned HTTPS origin rather than weakening cookie
  attributes;
- no session-bearing Supabase browser client and no Auth token in browser
  JavaScript, URL, storage, analytics or logs;
- `private, no-store` for authenticated/session-refresh and nonce-bearing pre-
  auth/Auth/MFA/recovery responses, with no tenant/Auth state in CDN/ISR/router
  cache;
- force-dynamic authenticated Next.js routes, `cache: "no-store"` Auth/customer
  fetches, server-applied refresh/cookie headers, zero/disabled hosting cache
  TTL, and no module-scope Supabase client or tenant/user state;
- no raw HTML or `dangerouslySetInnerHTML`; Markdown disabled in Alpha;
- pre-auth-transaction- then live-session-bound HMAC double-submit CSRF, exact
  Origin/canonical Host, Fetch-Metadata/content-type and trusted-proxy
  validation for every Route Handler/Server Action mutation;
- per-response CSPRNG nonce CSP with `strict-dynamic`, no `unsafe-inline` or
  `unsafe-eval`, and executable warm-instance nonce/header binding tests;
- clickjacking protection;
- safe redirect allowlist;
- state/nonce for GitHub flows;
- output encoding;
- bounded input;
- route/user/tenant plus direct-Auth OTP/IP/email abuse limits, generic
  anti-enumeration, CAPTCHA/risk equivalent and alerts;
- full-SHA CI Actions, approved registry, deny-by-default install scripts with
  reviewed build allowlist, lockfile/manifests consistency, dependency-diff
  review, SBOM/provenance, dependency and secret scanning;
- no production source maps, debug overlays/routes, diagnostics or internal API
  documentation outside an explicitly protected upload channel;
- stored/reflected/DOM/mutation XSS and malicious HTML/Markdown/SVG/URL corpus
  tests;
- local baseline plus separately authorized authenticated staging DAST with
  synthetic roles and zero provider/paid side effects;
- assigned manual Auth/session/authorization/CSRF/business-logic charter and
  independent full-platform penetration-test closure including Console/BFF/Auth
  before readiness.

### NFR-SEC-004 — Field-level capability projection

| Data/action | owner | admin | Reviewer/member | viewer |
|---|---:|---:|---:|---:|
| Repository and admitted memory summaries | yes | yes | yes | yes |
| Exact evidence | yes | yes | yes | yes |
| Aggregate token/cost/latency | yes | yes | no | no |
| Bounded validation issue codes | yes | yes | yes | read-only |
| Member email/list | yes | yes | no | no |
| Usage/Alpha metrics | yes | yes | no | no |
| Invite/role/entitlement/policy/paid actions | policy-specific | policy-specific | no | no |
| Review/lifecycle actions | yes | yes | yes | no |

Endpoint projections enforce this matrix server-side; UI hiding is not
authorization.

### NFR-PRIV-001 — Data minimization

List APIs return summary fields only. Detail APIs return only fields necessary
for the screen and role.

### NFR-AUD-001 — Auditability

Audit actor, organization, action, target, timestamp, result and bounded reason
for:

- membership changes;
- GitHub binding;
- entitlement activation/disable;
- policy/limit changes;
- backfill approval;
- review;
- lifecycle;
- retry.

No raw customer payload or secrets in audit metadata.

### NFR-REL-001 — At-least-once safety

All mutations are idempotent at business boundary. Duplicate browser request,
network retry, page reload или worker replay не создаёт duplicate business
outcome.

Database-only commands use transactional immutable command receipts. Auth,
GitHub and email side effects additionally use durable domain workflow states
and idempotent reconciliation.

### NFR-PERF-001 — List performance

- cursor pagination;
- default page size 50, maximum 100;
- no unbounded scans;
- no per-row N+1;
- tenant-first indexes;
- measured query plan with at least 1,000 repositories, 10,000 Knowledge
  Objects and 10,000 processing rows in one synthetic tenant;
- initial target: p95 server response under 500 ms for normal paginated reads
  in staging, excluding GitHub sync and long-running jobs.

### NFR-PERF-002 — Long-running operations

GitHub sync, backfill и extraction asynchronous. Web request возвращает
receipt/status resource, а не ждёт completion.

### NFR-ACC-001 — Accessibility

Customer workflows meet WCAG 2.2 AA target:

- keyboard navigation;
- visible focus;
- semantic headings/landmarks;
- labels and error association;
- contrast;
- non-color status indicators;
- screen-reader status announcements.

### NFR-COMP-001 — Contract compatibility

Console pins exact API contract version. Backend breaking change не deploy-ится
до совместимого Console release.

### NFR-OBS-001 — Observability

Для каждого web/API request доступны:

- correlation ID;
- organization-safe actor/route/action dimensions;
- latency/status;
- dependency result;
- redacted error code.

Source text, evidence quote, raw response, token и secret не входят в logs по
умолчанию.

### NFR-OPS-001 — Rollback

UI rollback не требует rollback migration. Backend schema changes
forward-only. New capabilities deploy-ятся additively до Console activation.

## 15. Product metrics and success criteria

### 15.0 Metric definitions

All periods use UTC half-open intervals `[from, to)`.

Knowledge cohort:

```text
admitted Knowledge Objects whose created_at is inside the period
```

All review/lifecycle projections use the same as-of cutoff `to`: only events
committed before `to` participate, ordered by database sequence/created time.
Initial extraction-quality metrics use the **first committed human review
before `to`** per Knowledge Object:

```text
reviewed_count =
  cohort objects with a first review

approved_without_edit_count =
  first decision APPROVED on original payload

edited_count =
  first decision EDITED

user_rejected_count =
  first decision USER_REJECTED

approval_without_edit_rate =
  approved_without_edit_count / reviewed_count

edit_rate =
  edited_count / reviewed_count

user_rejection_rate =
  user_rejected_count / reviewed_count
```

Re-review does not rewrite the initial quality metric. Separate current-state
counts use latest review sequence committed before the same cutoff `to`.

Lifecycle:

```text
lifecycle_eligible_count =
  cohort objects whose latest review before cutoff `to` is APPROVED or EDITED

active_count =
  lifecycle-eligible cohort objects whose latest effective lifecycle event
  at cutoff `to` is ACTIVE

superseded_count =
  lifecycle-eligible cohort objects whose latest effective lifecycle event
  at cutoff `to` is SUPERSEDED

unresolved_count =
  lifecycle-eligible_count - active_count - superseded_count

lifecycle_resolved_count =
  active_count + superseded_count

lifecycle_resolution_rate =
  lifecycle_resolved_count / lifecycle_eligible_count
```

Admission/operations cohort:

```text
terminal_run_cohort =
  distinct effective extraction_run IDs whose first terminal admission
  timestamp is inside [from, to); deduplicated alias jobs are excluded

accepted_runs / rejected_runs / quarantined_runs =
  count terminal_run_cohort by exact disposition

quarantine_rate =
  quarantined_runs /
  (accepted_runs + rejected_runs + quarantined_runs)

failed_jobs =
  distinct effective extraction_job IDs whose first dead-letter terminal event
  is inside [from, to) and which have no terminal extraction_run

latency_per_pr =
  per distinct (organization, repository, provider_pr_id), elapsed time from
  first admitted Source Envelope creation to first terminal admission;
  API reports count, mean, p50 and p95
```

Cost:

```text
cost_per_pr =
  sum each distinct execution's MEASURED settled provider cost once, for
  terminal_run_cohort executions /
  distinct (organization, repository, provider_pr_id) represented

cost_per_accepted_knowledge_object =
  same distinct-execution MEASURED cost numerator /
  distinct accepted Knowledge Object IDs produced by terminal_run_cohort
```

Execution cost is attributed to the period of its first terminal admission,
not attempt creation or later settlement; a later settlement updates that
period’s aggregate. If any included distinct execution is `UNRESOLVED`, the
aggregate is marked incomplete and never rendered as zero. `RESERVED` is not
measured cost. Zero denominator returns not-applicable.

Quality-learning taxonomy:

- every Edit/Reject records `NONE | MINOR | MAJOR | CRITICAL` issue severity;
- `CRITICAL` means the effective claim/evidence could cause a materially unsafe
  engineering decision;
- evidence validity is sampled by exact-quote/source verification;
- “material edit” means semantic fields changed, excluding copy-only note;
- partner value is collected through a versioned interview rubric with named
  owner, date, decision/use case and counterfactual time-to-context.

```text
critical_overclaim_rate =
  first reviews with EDITED or USER_REJECTED decision and CRITICAL severity /
  reviewed_count

evidence_validity_rate =
  sampled evidence claims passing exact-quote + source-attribution verification /
  all sampled evidence claims

evidence sample =
  deterministic sample manifest versioned by organization, period, seed and
  claim IDs; no replacement after result
```

`evidence_validity_rate` and every other ratio return not-applicable for zero
denominator. Published metrics include `[from,to)`, UTC, cohort timestamp,
distinct identity, numerator, denominator, completeness and formula version.

### 15.1 Technical Design Partner Ready

- EEM-3 complete and free staging-certified;
- EEM-5/source runtime deployed and free staging-observed;
- separate paid E2E approved and passed;
- one active and one locked repository scenario passed;
- no job/envelope/provider usage for locked repository;
- active `OFF` creates no live work;
- active `SOURCE_ONLY` creates source work but no provider authorization;
- active `AUTO_EXTRACT` processes an approved future merge;
- duplicate live delivery creates no duplicate work;
- backfill free→approval→paid flow passed;
- accepted/rejected/quarantined separation passed;
- checkpoint no-second-call passed;
- Auth/RBAC/RLS/BFLA tests passed;
- MFA/session/recovery/cache-isolation, authenticated DAST, manual security,
  independent full-platform penetration-test including Console/BFF/Auth and
  accessibility gates passed;
- all applicable Critical/High security findings independently closed/retested
  and every required ASVS row evidence-backed pass/not-applicable;
- review/edit/reject/lifecycle/supersede passed;
- rollback and incident contacts documented.

### 15.2 First design partner outcome

This is a separate post-readiness outcome owned by EEM-9/10. Technical Design
Partner Ready, EEM-9/08 paid evidence and chat acceptance do not authorize its
real partner data or paid workloads. It runs only in the approved
non-production environment unless production is separately certified.

- at least one external organization connected;
- every workload has its own approved partner/customer-data boundary;
- provider/model/budget consent and Evirion operational authorization apply
  only to each provider-bearing paid workload, not `OFF`/`SOURCE_ONLY`;
- `SEC-2026-010` is closed before any external object enters active/trusted
  retrieval; admitted objects stay `UNRESOLVED` until eligible review and
  explicit activation;
- at least one private/real repository activated;
- at least one other accessible repository remains locked;
- 100–300 historical PR prepared or a smaller explicitly approved pilot set;
- 50–100 admitted Knowledge Objects reviewed;
- Approval Without Edit Rate measured;
- Edit Rate measured;
- User Rejection Rate measured;
- Lifecycle Resolution Rate measured;
- at least 3 genuine `SUPERSEDES` relationships reviewed;
- actual cost/latency measured;
- at least 3 structured partner interviews completed, each recording concrete
  value/use case, counterfactual time-to-context and key usability problems.

### 15.3 Product targets versus release gates

Targets such as approval rate are product-learning goals, not reasons to hide
or rewrite unfavorable Alpha data.

Initial benchmark targets:

- approval without material edit: measure first, target trajectory toward
  80%+ for Alpha and 90% for paid pilot;
- critical overclaim: below 5% for Alpha, trajectory toward below 2%;
- evidence validity: 99%+;
- quarantine: below 10–15%, interpreted with workload context.

## 16. Release acceptance checklist

### Backend authorization

- [ ] Every customer mutation derives actor from auth context.
- [ ] Every tenant-owned row has non-null organization identity.
- [ ] Cross-tenant references fail at constraint layer.
- [ ] Authenticated cannot write protected base tables directly.
- [ ] Owner/Admin/Reviewer/Viewer matrix is executable.

### Repository entitlement

- [ ] GitHub access does not auto-activate.
- [ ] Concurrent limit cannot be bypassed.
- [ ] Webhook for locked repo creates no extraction work.
- [ ] Active `OFF`, `SOURCE_ONLY` and `AUTO_EXTRACT` behavior matches the
  policy matrix.
- [ ] Backfill for locked repo is denied.
- [ ] Source worker rechecks entitlement.
- [ ] Knowledge worker rechecks before new provider call.
- [ ] Every initial/repair logical operation has exact authorization and every
      transport attempt has an allowed append-only dispatch.
- [ ] Initial and repair checkpoint combinations finish without repeated call.
- [ ] Historical usage survives disable.

### Knowledge trust

- [ ] REJECTED/QUARANTINED create no KO.
- [ ] Queue contains admitted KO only.
- [ ] ACCEPTED but UNRESOLVED KO is absent from active/trusted retrieval until
      eligible review and explicit activation.
- [ ] Exact evidence visible.
- [ ] Human review does not mutate machine provenance.
- [ ] Human edit is reconstructable and immutable.
- [ ] Lifecycle independent from review/admission.
- [ ] Supersession is same-tenant, acyclic and atomic.

### Console security and quality

- [ ] No secret/service key in browser or repository.
- [ ] Supabase email-OTP/signup/MFA/AAL2/server-only-session/recovery/revocation parity tests pass.
- [ ] CSRF, CORS, per-response nonce CSP, redirect, Auth-abuse and authenticated cache-isolation tests pass.
- [ ] Raw HTML/Markdown is disabled and complete stored/reflected/DOM/mutation XSS corpus passes.
- [ ] ID tampering returns tenant-obscured response.
- [ ] Unknown state fails closed.
- [ ] Contract compatibility tests pass.
- [ ] Accessibility gate passes.
- [ ] Pagination and representative query plans pass.
- [ ] Digest-pinned baseline and authenticated staging DAST pass within the approved safe scope.
- [ ] Manual security charter and independent full-platform pentest/retest including Console/BFF/Auth pass.
- [ ] CI supply-chain policy and production source-map/debug-surface negatives pass.
- [ ] Applicable Critical/High findings and required ASVS rows meet the Technical Design Partner Ready gate.

### Operations

- [ ] Free local/CI gates pass.
- [ ] Free staging entitlement/source canary passes.
- [ ] Authenticated operator paid-authorization create/revoke is proven.
- [ ] Console staging security smoke passes.
- [ ] Paid E2E separately approved and passes.
- [ ] Rollback and incident runbook reviewed.
- [ ] Technical Design Partner Ready evidence decision passes.
- [ ] First design partner outcome, when separately authorized, is tracked as a distinct EEM-9/10 gate.

## 17. Requirement traceability convention

Every implementation PR must reference:

```text
Requirement IDs
Architecture sections
State/mutation contract rows
Executable tests
Release gate invalidated by later changes
```

Full requirement-to-PR-to-test ownership is maintained in
[EEM - Design Partner Console implementation plan](../plans/design-partner-console-implementation.md).

Acceptance-row identity is deterministic now:

- bullets under each `Acceptance:` block are
  `<requirement-id>.A1`, `.A2`, … in document order;
- a requirement without an explicit `Acceptance:` block has `.A1` equal to its
  complete normative statement/list;
- BR/NFR normative bullets use the same ordinal rule;
- after package approval, rows are never renumbered: removed rows become
  tombstones and new rows append;
- the implementation-plan primary PR/test for the parent requirement is also
  the sole primary owner/test for every `.A<n>` row, with one named
  parameter/case per row; secondary contributors cannot satisfy it.

## 18. Source-plan disposition

The downloaded source plan remains input evidence until the user approves this
package. Upon approval, this section explicitly supersedes its conflicting
parts.

| Source-plan area | Disposition | Corrected decision |
|---|---|---|
| Product goal and first-partner scenario | retained | Console validates one active plus one locked repository and human review |
| §2 existing backend foundation | retained and code-verified | extractor, envelope, admission, checkpoint, backfill and persistence are reused; no alternative pipeline |
| UI/Auth/entitlement/review readiness | current-code clarification, not a source premise | source §2 did not claim these were implemented; current code confirms they must be built/adapted |
| Console framework/Auth choice | new approved decision, not retained source content | Next.js + TypeScript + Supabase Auth in separate dashboard repository with server-only `HttpOnly` BFF sessions and versioned customer API |
| Supabase Admin invitation plus PKCE callback | rejected after current-doc verification | Admin invite links do not support PKCE; backend pre-provisions the Auth user and Alpha verifies email OTP server-side with `shouldCreateUser = false` |
| §§3.5/6 policy versus entitlement | retained | entitlement, policy, budget and paid authorization remain separate |
| Step 3 membership/Auth adaptation | clarified against current code | follow the source instruction to adapt existing owner/admin/member/viewer membership through capabilities |
| New `knowledge_lifecycle_state` | rejected | reuse append-only state events; add only correction events genuinely missing |
| New generic relationship table | rejected | reuse `knowledge_relations`; add relation-state correction events only |
| Human review/Edit | clarified | immutable review plus versioned editable projection; original/evidence unchanged |
| Paid E2E before any UI development | superseded | fixture/free development may proceed after EEM-3; paid E2E is release gate |
| Implement in current repository | replaced | backend remains current repo; UI/BFF goes to dashboard repo |
| §§3.4/6 GitHub access is not entitlement | retained | explicit RepositoryEntitlement remains mandatory |
| Nullable/manual/unlimited repository limit | replaced | explicit `FIXED | UNLIMITED`; missing row fails closed and operator provisions mode |
| Historical import | retained and constrained | existing backfill, `missing_only`, free prepare, customer consent and separate paid authorization |
| §6.4 “existing backfill create idempotency” | corrected from current code | internal create remains unexposed; B06A customer command receipt supplies durable create idempotency |
| Required paid approval | strengthened | source required approval; B06B makes Evirion operational authorization durable, scoped, expiring and revocable |
| Step-by-step UI surfaces | retained | reordered behind backend contract owners and security prerequisites |
| Design Partner Ready acceptance | retained, expanded and split | EEM-9/09 owns Technical Design Partner Ready using EEM-5/source, concurrency, security, rollback and bounded paid evidence; EEM-9/10 separately owns real partner data/workloads and first-outcome metrics |
| “Month 3 Alpha” schedule label | replaced | no date promise; post-EEM-3 forecast uses 764–1,194 focused hours, sustainable capacity, contingency and external waits |

## 19. Decisions fixed by this specification

1. Реализация начинается после EEM-3.
2. Paid E2E блокирует release, но не specification/development.
3. Console UI/BFF живёт в отдельном repository.
4. Backend schema/pipeline/API authority остаётся в engineering-memory repo.
5. Next.js App Router + TypeScript + Supabase Auth behind server-only
   `HttpOnly` BFF sessions is the Console baseline.
6. Integration is contract-first.
7. Existing membership, relations and lifecycle events are reused.
8. Entitlement не смешивается с repository policy.
9. Admission, human review и lifecycle независимы.
10. `PENDING` и `UNRESOLVED` derived from absence of effective events.
11. Human edits append-only.
12. Paid provider call never originates inside a web request.
13. Technical Design Partner Ready and first-design-partner outcome are separate
    gates; neither implies production certification.

## 20. Open items that do not block this specification

Следующие значения выбираются при implementation preflight, но не меняют
утверждённую архитектуру:

- exact stable Next.js/Supabase package versions;
- hosting vendor for Console;
- email delivery provider;
- exact accepted JWT, inactivity, absolute-session, concurrent-device and
  recent-reauthentication thresholds supported by the selected Supabase plan;
- exact Alpha repository limit per partner;
- exact approved paid budget;
- final p95 SLO after staging baseline;
- final retention period, если отличается между organizations.

Эти значения не являются неявными runtime defaults: до их явной конфигурации
соответствующий release gate остаётся закрытым.
