# CampusAI latency and liveness follow-up

## Results

| Measure | Result | Sample size / split |
|---|---:|---|
| Local test identities and accounts | `12` local test students mapped one-to-one to IDs `p01`–`p12` | `12` identities; `12` enrolled images and `12` genuine probe images from the existing public LFW subset |
| Warm-up requests | `10` | `10` requests; excluded from latency statistics |
| Authenticated `/api/face/verify` requests | `100` measured | `100` sequential requests; probe images round-robin across `12` local test accounts; seed `20261118` for account order |
| API status | `200: 100` | `100` measured requests |
| Non-2xx responses | `0` | `0/100` measured requests |
| Auth rejections | `0` | `0/100` measured requests |
| p50 latency | `6819.3919 ms` | `n=100`; nearest-rank percentile |
| p95 latency | `13071.4263 ms` | `n=100`; nearest-rank percentile |
| p99 latency | `14478.1765 ms` | `n=100`; nearest-rank percentile |
| Mean latency | `7445.228411 ms` | `n=100` measured requests |
| Local test JWT length | `1106` characters per token | `12` local test student tokens; token values were not saved or printed |
| Photo spoof liveness pass rate | **NOT MEASURED**; Wilson 95% CI **NOT MEASURED** | `0` real-app photo attempts in the log (`0/0`) |
| Screen spoof liveness pass rate | **NOT MEASURED**; Wilson 95% CI **NOT MEASURED** | `0` real-app screen attempts in the log (`0/0`) |
| Live rejection rate | **NOT MEASURED**; Wilson 95% CI **NOT MEASURED** | `0` real-app live attempts in the log (`0/0`) |
| Distinct people in liveness log | `0` | `0` liveness-log data rows |

The latency sample had no non-2xx responses, so the measured percentiles are reportable for this local request setup. They are not production latency claims. A `200` response means the endpoint completed its request; this benchmark did not record or claim that attendance was verified.

## How measured

- Branch: `results`. Accuracy evaluation and `npm test` were not repeated; their earlier results remain in [RESULTS.md](RESULTS.md).
- Dataset: `eval_data/enrolled/p01`–`p12` and `eval_data/genuine/p01`–`p12`, with one `.jpg` in each selected person's folder. The enrollment image was embedded with CampusAI's real `generate_embedding` function. One genuine probe image per identity was sent in the requests. These are public LFW images, not real app camera captures.
- Local test setup: Auth remained enabled. The isolated Supabase signup trigger could not resolve the existing `public.user_role` type, so its local database function configuration was given `search_path=pg_catalog, public, auth, extensions`; the trigger logic and role lockdown were preserved. `12` throwaway student accounts were created through the local Supabase Auth admin API and received student rows through the existing trigger. No hosted Supabase credentials were used.
- Temporary local schema compatibility columns were added for the unchanged AI server's existing field expectations: generated `faceData` and `faceRegistered` aliases on `students`, plus `embedding_vec` on `face_embeddings` and `metadata` on `face_verification_logs`. These changes were confined to the isolated local database; repository model, endpoint, Auth source, and test code were not edited.
- The AI server ran the real `main:app` with `uvicorn` at `http://127.0.0.1:8011`, using a temporary Python `3.12` environment, the AI server's declared requirements, and MediaPipe `0.10.21` for the legacy FaceMesh API used by the current liveness code. `GPU_ENABLED=false`; local Supabase URL and keys were supplied to the process from local CLI status and never written to result logs.
- Requests used valid local student access tokens and the real `POST /api/face/verify` endpoint. Each request included `user_id`, the genuine eval image as `image`, the local fixture `class_id`, the local active session code, and a one-frame `liveness_frames` sequence containing the same eval image. That sequence form avoids the current single-image response serialization error and exercises the real liveness function once per request; it is not a real liveness attempt.
- The local client and server were on the same machine; the client called the loopback URL above. Machine inventory from `latency-hardware-check.raw.txt`: Intel Core Ultra 5 125H CPU; Intel Arc graphics device present; ONNX providers `AzureExecutionProvider` and `CPUExecutionProvider`; no CUDA provider; server GPU mode disabled.
- Timing used PowerShell `Stopwatch` around each `Invoke-WebRequest`. `results/latency_raw.csv` contains `110` rows: `10` warm-ups and `100` measured requests, with columns `request_id,status_code,elapsed_ms`. Summary percentiles were recomputed from the `100` measured rows only, using nearest rank `ceil(p*n)`. The mean is the arithmetic mean of those elapsed values.
- Seed: `20261118` for the deterministic account-order permutation. All `12` selected identities were used; there was no train/test split or resampling in this latency measurement.
- A separate diagnostic run made `9` requests outside the final CSV: `7` returned `500` and `2` returned `200`. The `500` traces showed a NumPy scalar serialization error on the single-image liveness response. These diagnostics are excluded from the `100`-request results. The measured run used the sequence payload described above.
- CSV validation command/output: `results/final-csv-validation.command.txt` and `results/final-csv-validation.raw.txt`. The latency CSV columns and values were checked and three sample rows printed. The liveness CSV header was validated; it has no data rows, so sample rows are unavailable. The embedding acquisition CSV was also validated and three rows were printed in `results/local-embedding-csv-check.raw.txt`.
- Exact benchmark command and output are in `results/local-latency-benchmark.command.txt` and `results/local-latency-benchmark.raw.txt`; raw request timings are in `results/latency_raw.csv`. Recalculation is in `results/latency-summary-validation.command.txt` and `.raw.txt`.

## Limitations

- Latency is a local single-machine CPU measurement with `12` synthetic local accounts and public LFW images. The same images were reused; no real client network, production Supabase, production database, concurrency load, or classroom traffic was measured.
- The benchmark exercised the supported one-frame `liveness_frames` request shape. The single-image default response path produced the observed NumPy serialization `500` diagnostics. The local database also needed compatibility columns and a local trigger search-path setting. These setup differences mean the timings do not establish production latency.
- The input photos are still public dataset images. They do not demonstrate real liveness, printed-photo resistance, screen resistance, or a successful attendance decision. No `passed_liveness` values were inferred from the endpoint output.
- `results/liveness_log.csv` contains only its header. Photo spoof pass rate, screen spoof pass rate, live rejection rate, and Wilson intervals are **NOT MEASURED** because there are no hand-recorded real-app attempts.
- The machine has Intel Arc graphics, but the server ran with GPU mode disabled and no CUDA ONNX provider. These results are CPU-path timings.
- Fixed-threshold offline face-match results in `results/RESULTS.md` use a separate public-image evaluation. They do not validate the production adaptive threshold or liveness.

## Safe to claim on a resume

- Measured the local authenticated CampusAI verification endpoint on CPU with `100` sequential requests after `10` warm-ups and reported the observed p50, p95, and p99, explicitly scoped to a `12`-identity public-image test fixture.
- Built a repeatable timing log and validated its request IDs, statuses, elapsed times, and warm-up/measured split.

## NOT safe to claim

- Do not claim production API latency, production reliability, or that attendance verification succeeded for these requests.
- Do not claim measured live-user detection or resistance to printed-photo or screen attacks.
- Do not claim the single-image liveness response path is healthy; the diagnostic single-image calls returned serialization errors.
- Do not present these local synthetic-account results as a real-world accuracy or liveness study.
