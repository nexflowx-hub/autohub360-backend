# AutoHub360 Backend

Backend operacional do ecossistema AutoHub360.

Este repositório é independente do frontend `nexflowx-hub/autohub360-platform` porque possui ciclo de deploy, runtime, workers, filas, secrets e infraestrutura VPS próprios.

## Runtime

- Node.js 22 + TypeScript
- Fastify API
- Redis + BullMQ
- Supabase/PostgreSQL como source of truth
- Docker Compose em VPS

## Processos

- `api` — HTTP API (`:8090`)
- `worker` — processamento assíncrono BullMQ
- `scheduler` — agendamento e heartbeat operacional

## Endpoints iniciais

- `GET /api/health`
- `GET /api/ready`
- `GET /api/v1/system/capabilities`

## Segurança

Secrets nunca são versionados. Produção utiliza `/srv/secrets/autohub360/backend.env` com permissões restritas.

## Deploy VPS

O runtime usa redes Docker externas já provisionadas:

- `platform_edge`
- `autohub_internal`
- `autohub_egress`

Redis permanece isolado em `autohub_internal` e não publica `6379` no host.
