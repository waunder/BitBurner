# Gang monitoring — 2026-10-26

At 2026-10-26 16:22 PDT (Remote API `gang_status.json`, `ts=1793031724006`),
The Black Hand had wanted `66,680.0447`, wanted gain `+0.08948/cycle`, and
wanted penalty `0.9906679`. The controller reported `mode=territory-training`,
`gangObjective=money`, `cleanupMode=false`, and `territoryWarfareEngaged=false`.
Projected and actual wanted rates agreed, so the rise is live behavior rather
than a projection artifact. This crosses the monitoring threshold of 50k and
is a regression from the earlier low-wanted recovery window. All 12 members
were assigned to territory-training roles; three trained combat and nine ran
Money Laundering. Gang respect and faction reputation remain separate fields.

Opportunity cost: leaving cleanup disabled preserves respect and money growth,
but allows wanted to climb while the penalty is already severe. Next action is
to inspect the controller transition guard and apply only a reversible cleanup
band change if the source confirms a missed wanted-recovery condition.

At 16:36 PDT after restarting the controller, wanted was `57,403.4111` and
falling at `-6.1618/cycle`; projected rate was `-6.1557/cycle`, cleanup was
active with one cleaner, and penalty improved to `0.9924408`. This confirms the
threshold change is causal and live. Money rate was `$2.442m/s` and the wanted
target was met.

At 16:41 PDT, wanted crossed below the alert floor to `48,824.4538`, falling
at `-5.3039/cycle`; projected rate was `-5.2986/cycle`, cleanup remained true,
and penalty improved to `0.9937088`. Recovery remains healthy.
