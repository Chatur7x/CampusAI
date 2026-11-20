# CampusAI face verification results

## Results

| Measure | Result | Sample and split |
|---|---:|---|
| InsightFace model | `buffalo_l` | CampusAI face embedding implementation |
| Configured base threshold | `0.55` | Fixed for this offline evaluation; production applies the per-record adaptive rule described below |
| People | `50` | Seeded subset of identities from the LFW training metadata; public face photos |
| Images | `200` total: `50` in each of `enrolled`, `genuine`, `spoof_photo`, and `spoof_screen` | One image per identity per folder |
| Failure to acquire | `0/50` in each folder (`0.0` per folder) | All `200` evaluation images |
| Same-image sanity similarity | `0.9999999999999999` | One enrolled image compared with its own embedding using CampusAI's real functions |
| Genuine pairs | `50` | One enrolled image and one different LFW image for each person |
| Impostor pairs | `2,450` | All ordered cross-person enrolled/genuine combinations from the `50` identities |
| FAR at base threshold | `0.0` (`0/2,450` accepted); people-bootstrap 95% CI `[0.0, 0.0]` | `2,450` impostor pairs; bootstrap resamples people |
| FRR at base threshold | `0.14` (`7/50` rejected); people-bootstrap 95% CI `[0.06, 0.24]` | `50` genuine pairs; bootstrap resamples people |
| Photo presentation-composite face-match acceptance | `0.86` (`43/50` accepted); people-bootstrap 95% CI `[0.74, 0.94]` | `50` digital photo-card composites; face match only, liveness excluded |
| Screen presentation-composite face-match acceptance | `0.84` (`42/50` accepted); people-bootstrap 95% CI `[0.74, 0.94]` | `50` digital phone-screen composites; face match only, liveness excluded |
| EER | `0.020000000000000018`; people-bootstrap 95% CI `[0.0, 0.10016652789342215]` | Acquired genuine/impostor pairs only; all pairs acquired |
| Threshold at EER | `0.3736296004268338`; people-bootstrap 95% CI `[0.07494468394203688, 0.4031027420330876]` | Descriptive ROC result, not used to tune the production threshold |
| Liveness spoof pass/reject rates | **NOT MEASURED** | `results/liveness_log.csv` has `0` attempts; no real-app liveness records were supplied |
| Verification API latency | **NOT MEASURED** | AI server at `http://127.0.0.1:8011` refused the health connection; test URL and JWT environment variables were unset, so no authenticated verification requests could be sent |
| Test suite | `394` passed, `0` failed, `29` skipped, `1` xfailed | `npm test`; suite breakdown and skip reasons below |

These accuracy results are from a small sample of **50 people**. They are a benchmark result for this subset, not an estimate of deployment accuracy. The two spoof columns measure face similarity against digitally composed presentation images; they do not measure physical attacks or liveness.

## Read from the repository

- The verification endpoint is authenticated `POST /api/face/verify` in `ai-server/routes/face.py`.
- The configured base threshold is `0.55`. The adaptive function computes `base + min(enrollment_count * 0.01, 0.05) - min(age_days / 3650, 0.05)`, clamped to `[0.40, 0.80]`. The offline evaluator intentionally applies the fixed base threshold; production adapts the threshold per record.
- Face embeddings and cosine similarity use CampusAI's `generate_embedding` and `cosine_similarity` functions backed by InsightFace `buffalo_l`.
- Verification analyzes the submitted liveness frames as a sequence when frames are supplied; otherwise it analyzes the submitted image. The liveness and other signals are included in the combined confidence decision. This code inspection is not a liveness measurement.
- When an active session exists, location handling compares the submitted student coordinates with the session coordinates and radius. The verification route also passes location through the location-validation and confidence path. No location-attack evaluation was performed.

## Test results and skipped tests

| Suite | Passed | Failed | Skipped | Other |
|---|---:|---:|---:|---:|
| Backend Node tests | `104` | `0` | `0` | — |
| Integration Node tests | `49` | `0` | `10` | — |
| AI pytest suite | `241` | `0` | `19` | `1` xfailed |
| Overall | `394` | `0` | `29` | `1` xfailed |

The ten skipped Node integration tests and their exact skip messages were:

| Skipped test | Exact skip reason |
|---|---|
| `live: notifications rejects a request with no token` | `# set SUPABASE_URL + ANON_KEY + STUDENT_JWT` |
| `live: notifications rejects a tampered token` | `# set SUPABASE_URL + ANON_KEY + STUDENT_JWT` |
| `live: notifications refuses a non-admin student` | `# set STUDENT_JWT to run` |
| `live: security-monitor rejects a request with no token` | `# set SUPABASE_URL + ANON_KEY + STUDENT_JWT` |
| `live: security-monitor rejects a tampered token` | `# set SUPABASE_URL + ANON_KEY + STUDENT_JWT` |
| `live: security-monitor refuses a non-admin student` | `# set STUDENT_JWT to run` |
| `live: a tampered token is rejected by the attendance function` | `# set STUDENT_JWT to run` |
| `live: a student cannot mark attendance through the edge function` | `# set SUPABASE_URL + ANON_KEY + STUDENT_JWT` |
| `live: faculty from another class cannot mark attendance` | `# set FACULTY_JWT to run` |
| `live: the AI server refuses an unauthenticated face verify` | `# set AI_BASE_URL` |

The nineteen skipped AI pytest cases were all in `tests/ai/test_live_http.py`. For each of the eight protected paths below, both `test_endpoint_rejects_missing_token` and `test_endpoint_rejects_invalid_token` were skipped:

| Test function | Parameter path | Exact skip reason |
|---|---|---|
| `test_endpoint_rejects_missing_token` | `/api/face/verify` | `AI server not reachable at http://127.0.0.1:8011. Start it with:  cd ai-server && uvicorn main:app --port 8011` |
| `test_endpoint_rejects_missing_token` | `/api/face/identify` | `AI server not reachable at http://127.0.0.1:8011. Start it with:  cd ai-server && uvicorn main:app --port 8011` |
| `test_endpoint_rejects_missing_token` | `/api/face/register` | `AI server not reachable at http://127.0.0.1:8011. Start it with:  cd ai-server && uvicorn main:app --port 8011` |
| `test_endpoint_rejects_missing_token` | `/api/analytics/correlation` | `AI server not reachable at http://127.0.0.1:8011. Start it with:  cd ai-server && uvicorn main:app --port 8011` |
| `test_endpoint_rejects_missing_token` | `/api/attendance/fraud` | `AI server not reachable at http://127.0.0.1:8011. Start it with:  cd ai-server && uvicorn main:app --port 8011` |
| `test_endpoint_rejects_missing_token` | `/api/attendance/risk` | `AI server not reachable at http://127.0.0.1:8011. Start it with:  cd ai-server && uvicorn main:app --port 8011` |
| `test_endpoint_rejects_missing_token` | `/api/attendance/geo/validate` | `AI server not reachable at http://127.0.0.1:8011. Start it with:  cd ai-server && uvicorn main:app --port 8011` |
| `test_endpoint_rejects_missing_token` | `/api/session/start` | `AI server not reachable at http://127.0.0.1:8011. Start it with:  cd ai-server && uvicorn main:app --port 8011` |
| `test_endpoint_rejects_invalid_token` | `/api/face/verify` | `AI server not reachable at http://127.0.0.1:8011. Start it with:  cd ai-server && uvicorn main:app --port 8011` |
| `test_endpoint_rejects_invalid_token` | `/api/face/identify` | `AI server not reachable at http://127.0.0.1:8011. Start it with:  cd ai-server && uvicorn main:app --port 8011` |
| `test_endpoint_rejects_invalid_token` | `/api/face/register` | `AI server not reachable at http://127.0.0.1:8011. Start it with:  cd ai-server && uvicorn main:app --port 8011` |
| `test_endpoint_rejects_invalid_token` | `/api/analytics/correlation` | `AI server not reachable at http://127.0.0.1:8011. Start it with:  cd ai-server && uvicorn main:app --port 8011` |
| `test_endpoint_rejects_invalid_token` | `/api/attendance/fraud` | `AI server not reachable at http://127.0.0.1:8011. Start it with:  cd ai-server && uvicorn main:app --port 8011` |
| `test_endpoint_rejects_invalid_token` | `/api/attendance/risk` | `AI server not reachable at http://127.0.0.1:8011. Start it with:  cd ai-server && uvicorn main:app --port 8011` |
| `test_endpoint_rejects_invalid_token` | `/api/attendance/geo/validate` | `AI server not reachable at http://127.0.0.1:8011. Start it with:  cd ai-server && uvicorn main:app --port 8011` |
| `test_endpoint_rejects_invalid_token` | `/api/session/start` | `AI server not reachable at http://127.0.0.1:8011. Start it with:  cd ai-server && uvicorn main:app --port 8011` |
| `test_health_is_public` | — | `AI server not reachable at http://127.0.0.1:8011. Start it with:  cd ai-server && uvicorn main:app --port 8011` |
| `test_interactive_docs_are_disabled` | — | `AI server not reachable at http://127.0.0.1:8011. Start it with:  cd ai-server && uvicorn main:app --port 8011` |
| `test_validation_error_does_not_echo_the_payload` | — | `AI server not reachable at http://127.0.0.1:8011. Start it with:  cd ai-server && uvicorn main:app --port 8011` |

The Node live tests remained skipped because the test Supabase and token environment variables were not set. The AI live HTTP tests remained skipped because the local server was not reachable.

## How measured

### Dataset and evaluation

- Public source: [LFW dataset mirror](https://huggingface.co/datasets/marcelohaps/lfw), using its `train` metadata and image paths. The metadata contained `13,233` rows and `1,680` identities with at least two images. A deterministic sample of `50` eligible identities was selected with seed `20261118`; each identity's first two images in image-number order became one enrollment image and one genuine probe.
- Folder split: `eval_data/enrolled/` had `50` people and `50` images; `eval_data/genuine/` had `50` people and `50` images; each spoof folder had `50` people and `50` images. Genuine and spoof IDs all matched enrolled IDs.
- Spoof images were digital composites made from the genuine probe: a face image on a card-like white rectangle, or inside a drawn phone frame with a glare overlay. These are synthetic digital presentations, not photos captured from a printed sheet or a physical screen.
- Pair construction: one same-person genuine pair per identity; all cross-person ordered enrolled-to-genuine combinations for impostors; one same-person pair per identity for each spoof category.
- The evaluator calls CampusAI's real `generate_embedding` and `cosine_similarity`. The self-image sanity check returned `0.9999999999999999`.
- After the evaluator completed, its dataset-description field was corrected from a stale synthetic-data label to the actual LFW/composite dataset description. This metadata-only correction did not change embeddings, pairs, scores, or metrics; its command and output are retained separately.
- Base-threshold rates use the configured fixed value `0.55`. FAR is impostor accepts divided by impostor pairs; FRR is genuine rejects divided by genuine pairs. Spoof acceptance is match-only and excludes liveness.
- EER uses acquired genuine and impostor scores and the ROC point with the smallest absolute difference between FAR and FRR. This is a sampled-point estimate. The EER threshold is descriptive only; it was not used to tune the fixed threshold.
- Bootstrap intervals use `1,000` resamples of the `50` people with seed `20261118`, not independent pair resampling. A person's repeated sampled multiplicity weights their same-person observations; cross-person pairs receive the product of both people’s multiplicities.
- ROC plot: `results/roc_curve.png`; score histogram: `results/score_histogram.png`; machine-readable scores and summary: `results/pair_scores.csv`, `results/image_acquisition.csv`, `results/roc_curve.csv`, and `results/evaluation.json`.

### Commands and raw outputs

| Measurement | Command | Saved command and raw output |
|---|---|---|
| Dataset counts and identity check | `results/lfw50-dataset-check.command.txt` | `results/lfw50-dataset-check.raw.txt`, `results/lfw50-identity-check.raw.txt` |
| Dataset creation | `results/lfw50-prepare.command.txt` | `results/lfw50-prepare.raw.txt`; digital spoof composites: `results/lfw-spoof-composites.command.txt`, `results/lfw-spoof-composites.raw.txt` |
| Self-image and real embedding smoke check | `results/lfw50-self-check.command.txt` | `results/lfw50-self-check.raw.txt` |
| Accuracy, ROC, EER, bootstrap | `.venv-eval/Scripts/python.exe scripts/evaluate_face_verification.py --data eval_data --seed 20261118 --bootstrap 1000 --out results` | `results/lfw50-evaluation.command.txt`, `results/lfw50-evaluation.raw.txt`, `results/lfw50-evaluation.exit.txt` |
| Correct generated dataset-description metadata only | `results/correct_lfw_metadata.ps1` | `results/lfw50-metadata-correction.command.txt`, `results/lfw50-metadata-correction.raw.txt` |
| Fixed-threshold pair counts | `results/pair-summary.command.txt` | `results/pair-summary.raw.txt` |
| CSV header, type, and sample-row validation | `results/csv-sample-check.command.txt` | `results/csv-sample-check.raw.txt` |
| Full test suite | `npm test` | `results/npm-test.command.txt`, `results/npm-test.raw.txt`, `results/npm-test.exit.txt` |
| AI skip reasons | `python -m pytest tests/ai -q -rs` | `results/pytest-skip-reasons.command.txt`, `results/pytest-skip-reasons.raw.txt` |
| Hardware and runtime providers | See `results/hardware-check.command.txt` | `results/hardware-check.raw.txt` |
| Liveness CSV validation | See `results/liveness-metrics.command.txt` | `results/liveness-metrics.raw.txt`; CSV validation also appears in `results/csv-sample-check.raw.txt` |
| API availability and test environment | See `results/ai-health-check.command.txt` and `results/liveness-and-env-check.command.txt` | `results/ai-health-check.raw.txt`, `results/liveness-and-env-check.raw.txt` |

CSV validation confirmed expected columns and semantic values for all four CSV files. It printed three data rows for each nonempty CSV. `liveness_log.csv` has the expected four columns but zero data rows, so there are no honest sample records to print.

## Limitations

- The accuracy sample contains only `50` people and one image in each category per person. It is a small sample and may not represent CampusAI users, capture devices, or deployment conditions.
- LFW images are public dataset photos, not fresh app-camera captures, and this split does not establish a different-day or different-room genuine set.
- Photo and screen spoof inputs are digitally rendered composites. No physical printed-photo or real phone-screen attack was captured or tested.
- Face-match spoof acceptance excludes liveness. The hand-filled liveness CSV contains no attempts, so photo/screen liveness pass rates, live rejection, and Wilson intervals are **NOT MEASURED**.
- The offline analysis uses fixed threshold `0.55`; production applies an adaptive threshold per record. The reported fixed-threshold metrics do not establish production behavior under the adaptive rule.
- Latency is **NOT MEASURED**: the local server health request was refused, `AI_BASE_URL`, `STUDENT_JWT`, `FACULTY_JWT`, `SUPABASE_URL`, and `ANON_KEY` were unset, and no authenticated verification request was sent. The required warm-up and measured requests therefore could not be run. Client/server placement and latency percentiles are also **NOT MEASURED**.
- The evaluation ran on an Intel Core Ultra 5 125H machine. The recorded ONNX providers were `AzureExecutionProvider` and `CPUExecutionProvider`; `nvidia-smi` was unavailable and no CUDA provider was listed. This is not a GPU latency benchmark.
- Existing unrelated working-tree changes were present. The active branch is `results`; `eval_data/` and its sample image are ignored by Git, and the evaluation did not commit any files.

## Safe to claim on a resume

- Built and ran a reproducible face-verification evaluation that calls CampusAI's actual embedding and cosine-similarity code, records acquisition failures, computes ROC/EER, and bootstraps confidence intervals by person.
- On a seeded `50`-identity LFW subset with `50` genuine pairs and `2,450` impostor pairs, the fixed `0.55` threshold produced FAR `0.0` (`0/2,450`) and FRR `0.14` (`7/50`), with people-bootstrap 95% intervals reported above.
- Re-ran the existing suite: `394` passed, `0` failed, `29` skipped, and `1` xfailed; live tests were skipped because their server/project/token prerequisites were absent.

## NOT safe to claim

- Do not claim the system has a general real-world accuracy, production FRR/FAR, or demonstrated attendance reliability from this small public-image subset.
- Do not claim resistance to physical print or screen attacks; the tested spoof inputs were digital composites.
- Do not claim liveness spoof-detection performance, since there were no real-app liveness attempts in the log.
- Do not claim API latency, low-latency performance, or same-machine/client-server latency; no authenticated API benchmark ran.
- Do not claim that the fixed-threshold offline results validate the production adaptive threshold.
