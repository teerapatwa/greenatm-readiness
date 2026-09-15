---
name: connect-qwen-fpt
description: Connect a workshop application's backend to the facilitator-provided Qwen inference service hosted in FPT Cloud. Confirm the API contract, model ID and authentication before building the integration.
disable-model-invocation: true
---

# Connect the prototype to Qwen in FPT Cloud

## Scope and current status

This configures the model used by the application you are building. It does not configure Claude Code's own coding model or grant Claude Code account access.

This workshop service is a particular deployment hosted in FPT Cloud. Do not assume it follows a provider-wide FPT managed-model API.

The facilitator supplied the updated IP on 15 September 2026. Port, API path and model alias below are retained from the earlier talk notes and still require verification:

| Setting | Recorded value — confirm before use |
|---|---|
| Base URL | `http://124.197.18.95:8000/v1` |
| Model alias | `qwen3.8-27b` |
| API style | Intended OpenAI-compatible Chat Completions |
| Authentication | Key supplied separately by the facilitator |

**Readiness: updated IP supplied; live connectivity has not yet been verified for this address.** Its port, API path, current model list, authentication and optional request parameters have not been verified. The alias above is copied from the notes; it is not a claim about an official Qwen release name. Verify the connection and exact served model ID before integration.

The recorded endpoint uses plain HTTP. Obtain the facilitator's approved HTTPS endpoint or private-network route before sending a real key or non-public data. Do not send credentials to an arbitrary replacement URL, put them in a browser bundle, or weaken TLS validation.

## Use this file

Option A: place this file beside `PLAN.md` and tell Claude Code:

> Read PLAN.md and QWEN-FPT-INTEGRATION.md. Confirm the facilitator's endpoint, model ID and authentication, verify a real response, then connect one complete application workflow. Treat unverified settings as unresolved rather than guessing.

Option B: copy this file to `.claude/skills/connect-qwen-fpt/SKILL.md` inside your project. Start Claude Code there and invoke `/connect-qwen-fpt`. No separate skill package is required. This skill is explicitly invoked; it does not run automatically.

## Local configuration

Use the project's established environment-file convention. Keep the actual file out of Git and distribute only placeholders. These are application-defined variables, not Claude Code configuration variables.

```dotenv
LLM_BASE_URL=<FACILITATOR_CONFIRMED_BASE_URL_ENDING_IN_V1>
LLM_MODEL=<EXACT_SERVED_MODEL_ID>
LLM_API_KEY=<ENTER_LOCALLY>
LLM_TIMEOUT_MS=120000
```

The placeholders must be replaced before requests run. Reject unresolved placeholders at startup with a useful configuration error. Load credentials on the backend. Never print or paste a key into a conversation, screenshot, commit or client-side environment variable. The timeout is a configurable workshop starting value, not measured endpoint performance.

## Prove the connection

Run checks from the machine that will execute the application backend.

1. Confirm the approved endpoint and network route with the facilitator.
2. Request `GET /v1/models`, using the specified authentication. If the gateway does not expose this route, use the facilitator-confirmed model ID and document that model discovery is unavailable.
3. Make one non-streaming `POST /v1/chat/completions` request. Start with the minimal payload below, replacing the model placeholder.
4. Require a successful HTTP status and non-empty `choices[0].message.content`. Inspect answer relevance; connectivity alone is not a behavior test.
5. Record the confirmed model ID, API features that actually worked, and any failures. Never replace a failed model request with a canned answer and call the integration complete.

```json
{
  "model": "<EXACT_SERVED_MODEL_ID>",
  "messages": [
    {"role": "system", "content": "Reply briefly in Thai. Keep missing information explicit."},
    {"role": "user", "content": "พนักงานบอกเพียงว่า VPN ใช้งานไม่ได้ ควรถามข้อมูลอะไรเพิ่มก่อนแนะนำวิธีแก้?"}
  ],
  "stream": false,
  "temperature": 0,
  "max_tokens": 2048
}
```

This initial limit allows room for possible reasoning in an unverified deployment; it does not guarantee a final answer. Inspect the finish reason if final content is empty. Do not use reasoning text as the final reply.

## Thinking and optional capabilities

Ask the facilitator which Qwen model and serving stack are deployed. For Qwen/vLLM deployments whose chat template supports it, the raw request can include:

```json
"chat_template_kwargs": {"enable_thinking": false}
```

This is an additional top-level field in the request object, not a complete standalone request. Verify support on this endpoint before relying on it. Some SDKs carry such fields in `extra_body`; do not send that SDK wrapper as the raw HTTP field.

After confirming non-thinking mode, use a smaller final-answer budget appropriate to the task. A low sampling temperature does not guarantee factual correctness. Do not assume that streaming, tool calling, JSON-schema output, images, speech or embeddings work merely because ordinary chat works. Test only the capabilities required by PLAN.md.

## Integrate into the application

- Follow the existing starter, stack and package manager. Use a backend route or server function for model calls.
- Store the destination in backend configuration. Append `/chat/completions` once to a base URL ending in `/v1`.
- Send `Content-Type: application/json`; use the facilitator's specified authentication, normally a Bearer header for an OpenAI-compatible service.
- Keep the same internal application interface for DGX and FPT where their confirmed API contracts match. Preserve provider-specific options explicitly; changing the model ID alone may not be sufficient.
- Start with text and non-streaming responses. Handle unsuccessful HTTP statuses, timeouts, empty content and truncated responses without inventing a successful result.
- For document-based answers, extract or retrieve the relevant text and attach source IDs in the model context. A filename alone is not document content. Preserve evidence links in the application output.
- For tool use, verify the returned tool-call format, validate arguments, execute allowed operations in application code, and send the result back to the model. Test a real tool interaction separately from ordinary chat.
- Enforce permissions, required fields and stopping limits in backend logic. Validate source support for extracted facts as well as the JSON shape.
- Keep integration tests with the real endpoint separate from scripted fixture tests. Label both in the results.

## Database and deployment boundary

The Qwen endpoint performs inference; it does not store your application's records. For a team's local prototype, reuse the starter database or use SQLite on the backend machine. Store cases, messages and drafts; keep sample PDFs in a separate data directory.

Use a facilitator-provisioned shared database when teams need concurrent access from multiple machines or a persistent cloud deployment. Do not create a different cloud database account for each team during the opening briefing. Do not assume a local SQLite file persists on a serverless deployment.

Before a hosted demo, check model reachability and authentication from that hosted backend, not just the laptop. Configure its environment separately. Confirm source-data handling with the facilitator before using documents beyond the provided samples.

## Troubleshooting

| Symptom | Check |
|---|---|
| Timeout / refused connection | Endpoint address, service readiness, firewall/allowlist and backend network route |
| 401 / 403 | Authentication scheme and key availability; do not print the key |
| 404 / unknown model | Base path and the exact served model ID |
| 400 on thinking or tool parameters | Whether this model, template and gateway support that option |
| Empty answer / token limit reached | Finish reason, supported thinking setting and output budget |
| TLS error | Correct HTTPS hostname and certificate; do not disable verification |
| Works locally but not when hosted | Hosted environment variables, egress route and service access policy |

## Completion evidence

Show a real relevant model reply in the application, a handled failure, and the saved record after a reload. For document retrieval or tools, show the actual source or execution result. State which features were tested against the endpoint and which remain mocked or unverified.

## Sources

- Updated IP: facilitator message, 15 September 2026.
- Port, API path and model alias: `idea-to-prototype-talk.md`; require verification on the updated address.
- Qwen serving and optional thinking configuration: https://qwen.readthedocs.io/en/latest/deployment/vllm.html
- Claude Code skill installation: https://code.claude.com/docs/en/skills
- SQLite deployment fit: https://www.sqlite.org/whentouse.html
