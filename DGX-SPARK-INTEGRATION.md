---
name: connect-dgx-spark
description: Connect a workshop application's backend to the facilitator-managed DGX Spark vLLM endpoint. Verify the served model and a real response before integrating the UI.
disable-model-invocation: true
---

# Connect the prototype to DGX Spark

## Scope and current status

This configures the model used by the application you are building. Claude Code's own account and coding-model configuration are separate.

The facilitator manages the DGX servers. Participants connect to the inference API; they do not install models, restart containers, change server settings, or expose the DGX to the internet.

Endpoint addresses supplied by the facilitator on 15 September 2026. Model and serving settings below come from `DGX_WORKSHOP_STATE.md`, dated 13 September 2026:

| Setting | Recorded value |
|---|---|
| DGX 1 base URL | `http://10.0.63.215:8000/v1` |
| DGX 2 base URL | `http://10.0.63.239:8000/v1` |
| Served model alias | `nemotron-3.5-lightning` |
| Backend | vLLM; OpenAI-compatible Chat Completions |
| Thinking | Enabled by default; request non-thinking for the initial workshop test |

**Readiness: the facilitator has supplied these updated addresses; live connectivity has not yet been verified for them.** Run the connection checks below from the machine that will execute your application backend. Confirm your assigned server and authentication requirement with the facilitator. Do not silently switch servers or substitute a different model.

## Use this file

Option A: place this file beside `PLAN.md` and tell Claude Code:

> Read PLAN.md and DGX-SPARK-INTEGRATION.md. Verify the assigned model connection first, then integrate it into one complete application workflow. Report actual results and any blockers.

Option B: copy this file to `.claude/skills/connect-dgx-spark/SKILL.md` inside your project. Start Claude Code there and invoke `/connect-dgx-spark`. No separate skill package is required. This skill is explicitly invoked; it does not run automatically.

## Local configuration

Use the project's established environment-file convention. Keep the actual file out of Git; commit only a placeholder `.env.example`. These are application-defined variable names, not Claude Code configuration variables.

```dotenv
LLM_BASE_URL=http://10.0.63.215:8000/v1
LLM_MODEL=nemotron-3.5-lightning
LLM_API_KEY=
LLM_TIMEOUT_MS=120000
```

Replace the base URL with the assigned server. A blank key means omit the Authorization header only if the facilitator confirms this server allows unauthenticated workshop requests. If a key is required, enter it locally; never put it in prompts, screenshots, browser bundles, or logs.

The 120-second timeout is a proposed starting value for a shared workshop server, not a latency guarantee. Make it configurable and cancel abandoned requests.

## Prove the connection before building the UI

Run checks from the machine that will execute the application backend.

1. Reach the assigned server's `GET /health` endpoint, outside `/v1`.
2. Request `GET /v1/models`. Include authentication if required.
3. Confirm the intended model alias is present. If it differs from this file, stop and ask the facilitator which served ID to use.
4. Send one non-streaming `POST /v1/chat/completions` request using the confirmed model ID and the payload below.
5. Require a successful HTTP status and non-empty `choices[0].message.content`. Check the answer is relevant. A successful health check alone is insufficient.

Example request body for the recorded configuration:

```json
{
  "model": "nemotron-3.5-lightning",
  "messages": [
    {"role": "system", "content": "Reply briefly in Thai. Do not invent missing facts."},
    {"role": "user", "content": "พนักงานบอกเพียงว่า VPN ใช้งานไม่ได้ ควรถามข้อมูลอะไรเพิ่มก่อนแนะนำวิธีแก้?"}
  ],
  "stream": false,
  "temperature": 0,
  "max_tokens": 512,
  "chat_template_kwargs": {"enable_thinking": false}
}
```

For a raw HTTP request, `chat_template_kwargs` is a top-level field. Some SDKs instead put non-standard fields inside an SDK-specific `extra_body` option; that wrapper is not part of this raw JSON payload. The recorded DGX deployment supports the flag; verify that remains true today. Low temperature reduces sampling variation but does not guarantee correctness or identical outputs.

Report: server reached, model ID confirmed, response received, relevant answer checked. Report any unsuccessful step accurately; do not substitute a canned answer and claim the integration works.

## Integrate into the application

- Follow the existing stack and package manager. Call the model from a backend route or server function.
- Use the configured base URL ending in `/v1`, then append `/chat/completions` once. Avoid `/v1/v1`.
- Keep the API destination in server configuration, not in user input. Use `Content-Type: application/json`; use `Authorization: Bearer <key>` only when required.
- Start with text and non-streaming responses. Validate HTTP status, error responses and final content before showing a reply.
- Use sample data approved for the workshop. Passing a PDF filename does not give the model its contents: extract the text or implement retrieval, and include the relevant passages with source IDs in the request.
- An ordinary prompt that mentions a tool is not tool execution. If tools are needed, verify a real `tool_calls` response, validate the arguments, execute only allowed server-side operations, and return the tool result to the model.
- Explicitly test tool calling for the chosen model/server configuration. Treat wrong or missing tool calls as test failures; do not assume text generation proves agent behavior.
- Keep the model's output separate from application state validation. Validate types, required fields, permissions and allowed state changes. Check source support for extracted facts; a valid JSON shape is not proof of factual accuracy.
- Save the case and draft in the chosen database. The LLM endpoint is not a database.

## Database and deployment boundary

For one team's local prototype, use the provided starter's database, or SQLite on the backend machine if none is provided. Store cases, messages, drafts and article references there; keep source PDFs in a sample-data directory. Verify a saved case remains after a reload and backend restart.

A private DGX address must be reachable from the backend's network. Moving the frontend to cloud hosting does not create that route. Demo locally unless the facilitator supplies a working hosted-backend connection. Do not publish the DGX port or change its network protections to make a demo work.

## Troubleshooting

| Symptom | Check |
|---|---|
| Timeout or connection refused | Assigned IP, server readiness, venue network, client isolation, and backend network route |
| 401 / 403 | Whether authentication is required and correctly configured; do not print the key |
| 404 | Base URL/path and the exact served model ID |
| Empty final content | Thinking configuration, token limit and finish reason; do not display reasoning text as the final answer |
| 400 on optional parameters | Confirm the serving configuration; do not silently ignore rejected settings |
| Works in a terminal but not in the app | Backend environment loading, URL construction, timeout and actual deployment location |
| Busy server | Surface a recoverable error; coordinate with the facilitator rather than repeatedly retrying |

## Completion evidence

Show one real model reply in the application, one handled model/network failure, and the saved result after a reload. If retrieval or tools are in PLAN.md, show their actual source or execution trace. Mark mocks explicitly. Record which checks were run, where, and which remain incomplete.

## Sources

- Endpoint addresses: facilitator-provided API endpoints image, 15 September 2026.
- Model and serving configuration: `DGX_WORKSHOP_STATE.md`, 13 September 2026. Historical setup evidence; not a fresh health check.
- NVIDIA vLLM on DGX Spark: https://build.nvidia.com/spark/vllm/over
- Claude Code skill installation: https://code.claude.com/docs/en/skills
- SQLite deployment fit: https://www.sqlite.org/whentouse.html
