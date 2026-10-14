# City activity time/weather implementation report

## Summary

Implemented the activity-time/weather policy and completed the focused follow-up for pedestrian zone allocation, dog ownership, flock safety, and deep-night activity. Changes do not alter landmark/layout geometry, add models, expand instance budgets, or change weather fetching. The implementation agents did not perform browser QA. Subsequent user-authorized background GPT-6 Luna Chrome verification reached **PARTIAL PASS**; see the browser reports below.

## Follow-up changes

- `src/agents/AgentSystem.js`
  - Rebalances live pedestrian populations against zone targets for `street`, `square`, `promenade`, and `beach`, retiring excess and directing new spawns to the largest eligible deficit. A zero-target leisure zone is not selected for new spawns. Leisure targets are normalized within the total pedestrian target; when square and promenade are both available, a deliberate share goes to each. HCMC’s civic square therefore receives walkers instead of losing all leisure traffic to riverside paths.
  - Keeps existing pedestrian slots as dog owners. Owner/dog links are cleared on deactivation and city switch; reused walkers reset dog flags and receive a generation token. Dogs retain the owner generation and path and retire if the owner is inactive, leaving, reused, or changes path.
  - Active flocks and newly spawned birds use the common hazard policy, including vortex and fog. Bird checks consume normalized/defaulted policy weather so older minimal environment objects remain valid.
  - Pedestrian `_chooseWalk()` remains quota-driven, while cats choose independently among safe walk paths. Dog spawning continues to reuse the owner's exact path and direction, and beach paths remain excluded whenever the shared policy marks them unsafe.
  - Adds stronger local-time suppression for boats, cyclos, and dogs during deep night while preserving morning and early-evening activity. Existing river-only boat routes, rain umbrellas/ponchos, turning, road allowlists, speed limits, and instance budgets remain unchanged.
- `src/agents/activityPolicy.js`
  - Maintains continuous modulo-midnight time curves. Beach-service timing uses smooth shoulders, while service still closes discretely when safety/daylight conditions fail.
  - Removed an unused cyclist policy result and unused time-helper export.
- `src/agents/activityPolicy.js`
  - Returns normalized weather fields (`night`, `rain`, `fog`, `snow`, etc.) alongside derived activity policy so consumers can apply safe defaults consistently.
- `scripts/activitycheck.mjs`
  - Asserts actual live zone counts for all cities at noon, 20:00 with `night=1`, and 02:00 with `night=1`; checks that evening square/promenade allocation rises over noon and falls at deep night, including an explicit HCMC square assertion.
  - Proves natural flock spawning with a legacy minimal clear-weather environment that omits fog/snow. For every shared hazard, it begins with an active flock and asserts every bird slot becomes inactive after the fade settles.
  - Asserts cats remain active after pedestrian quotas fill, retire during settled cyclone, and recover after calm weather. Also exercises condition presets, isolated hazards, beach furniture visibility/city reset, dog path invalidation and slot reuse, budgets, and finite instance matrices.
- `AGENTS.md`
  - Documents the durable zone-quota, dog-link, flock-safety, beach-furniture requirements and expanded regression expectations.

## Verification

The corrected full regression command completed with exit status 0:

```sh
npm run build && npm run smoke && node scripts/turncheck.mjs && node scripts/beachcheck.mjs && node scripts/lightcheck.mjs && node scripts/operacheck.mjs && node scripts/officecheck.mjs && node scripts/activitycheck.mjs && node scripts/boundscheck.mjs && node scripts/hcmccheck.mjs && node scripts/alleycheck.mjs && node scripts/cathedralcheck.mjs && node scripts/bridgecheck.mjs && node scripts/ringcheck.mjs
```

Results:

- Build succeeded. Vite emitted its existing warning that the minified JS chunk exceeds 500 kB.
- Smoke succeeded for Hà Nội, Đà Nẵng, and HCMC. No `NaN matrices` or runtime errors were reported; counts vary with randomized agent spawning. Calm gale recovery completed.
- Turn, beach, lighting, Opera House, office-window, activity, boundary, HCMC, alley, cathedral, bridge, and lake-ring regressions all passed.
- After the full batch, removed the unused `cyclists` policy result and unused `activityTime` export; reran `npm run build && node scripts/activitycheck.mjs`, which passed. The activity regression was strengthened with explicit dog path invalidation, retirement, and reuse of the same pedestrian slot, then rerun independently and passed.
- No footprint checks were run because this follow-up changes no layout or generation geometry.

An initial attempt at the batch used the mistyped path `scripts/operachecheck.mjs` and stopped after the build, smoke, turn, beach, and lighting checks had passed. The corrected command above used `scripts/operacheck.mjs` and completed successfully.

### Final narrow regression follow-up

The final coordinator changes were limited to independent cat route selection, normalized bird weather defaults, and stronger regressions. No policy/layout redesign was made. Browser verification remains explicitly out of scope.

Verification after these final code edits completed successfully (exit status 0):

```sh
npm run build && npm run smoke && node scripts/activitycheck.mjs && node scripts/beachcheck.mjs && node scripts/turncheck.mjs
```

- Build succeeded; Vite emitted the existing warning for a minified chunk over 500 kB.
- Smoke succeeded for Hà Nội, Đà Nẵng, and HCMC. Inspected output contained no `NaN matrices` or runtime-error messages; calm gale recovery completed.
- Activity, beach, and 48-combination turn regressions passed, including the new natural minimal-env flock spawn, settled full-slot flock retirement, and cat quota-independent spawning/cyclone retirement/calm recovery assertions.

## Limitations

- **Browser/visual QA: PARTIAL PASS.** After Chrome MCP was enabled and the user authorized background Luna browser QA, beach service night/thunderstorm closure and same-page restoration, all-city 20:00/02:00 crowd differences, and mobile portrait/landscape rendering and sampled UI interactions passed. Sampled walking/owner links and shared cyclone activity counters were checked. Drizzle protection models and cyclone shutdown/recovery still lack adequate visual proof. See `docs/activity-browser-qa-report-20261014-204331.md` and `docs/activity-browser-qa-supplement-20261014-204331.md`; screenshots are under the matching `ref/qa-city-activity-20261014-204331-luna-{01,02}/` directories. Earlier NOT VERIFIED statements describe the pre-browser implementation stage.
- Headless checks do not prove rendered visibility, mobile performance, live weather-network behavior, or intersection-wide traffic collision avoidance.
