import test from "node:test";
import assert from "node:assert/strict";
import { graftPrice, graftPriceFromRawBase, graftTimeMs, focusFactor, entropyFactor, entropyValue, netValue,
  buildCatalog, planGraft, installBlocked, intelligenceBonus, DEFAULT_GRAFT_CONFIG } from "./graft_logic.js";

const m = over => ({ hacking: 1, hacking_exp: 1, strength: 1, defense: 1, dexterity: 1, agility: 1, charisma: 1, company_rep: 1, ...over });

// Multipliers and game times copied from runtime/graft_probe_g1.json (intelligence 146).
const SPTN = m({ hacking: 1.15, strength: 1.75, defense: 1.75, dexterity: 1.75, agility: 1.75 });
const SPINE = m({ strength: 1.15, defense: 1.15, dexterity: 1.15, agility: 1.15 });
const QLINK = m({ hacking_chance: 2.5, hacking_speed: 2, hacking_money: 4, hacking: 1.75 });
const G_SPINE = m({ strength: 1.6, defense: 1.6, dexterity: 1.6, agility: 1.6 });
const BITWIRE = m({ hacking: 1.05 });
const CURE = m({});

const WEIGHTS = { hacking: 1.5, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, hacking_exp: 0.1 };

test("graft price is 0.6 x game base price, equal to 3 x raw base", () => {
  assert.equal(graftPrice(24375000000), 14625000000);
  assert.equal(graftPriceFromRawBase(4875000000), 14625000000);
  assert.equal(graftPrice(125000000000000), 75000000000000);
});

test("graft time matches the G1 live values at intelligence 146", () => {
  assert.ok(Math.abs(intelligenceBonus(146) - 1.0898) < 0.001);
  assert.ok(Math.abs(graftTimeMs(SPTN, 146) - 5825081.87) < 5);
  assert.ok(Math.abs(graftTimeMs(SPINE, 146) - 4462186.16) < 5);
  assert.ok(Math.abs(graftTimeMs(QLINK, 146) - 6371372.31) < 5);
  assert.ok(Math.abs(graftTimeMs(SPTN, 146) / 3.6e6 - 1.62) < 0.01);
  assert.ok(Math.abs(graftTimeMs(SPINE, 146) / 3.6e6 - 1.24) < 0.01);
  assert.ok(Math.abs(graftTimeMs(QLINK, 146) / 3.6e6 - 1.77) < 0.01);
});

test("graft time: no multipliers is 15 minutes, intelligence 0 has no bonus", () => {
  assert.equal(graftTimeMs(CURE, 0), 900000 * 1);
  assert.ok(graftTimeMs(SPTN, 1000) < graftTimeMs(SPTN, 100));
  assert.ok(graftTimeMs(SPTN, 100) < graftTimeMs(SPTN, 0));
});

test("focus factor: unfocused 0.8 unless Neuroreceptor Management is owned", () => {
  assert.equal(focusFactor(true, false), 1);
  assert.equal(focusFactor(false, false), 0.8);
  assert.equal(focusFactor(false, true), 1);
});

test("entropy factor and value", () => {
  assert.equal(entropyFactor(0), 1);
  assert.ok(Math.abs(entropyFactor(10) - 0.8171) < 0.001);
  assert.ok(Math.abs(entropyValue(WEIGHTS) - 4.8 * 0.0202027) < 1e-4);
  assert.equal(entropyValue(WEIGHTS, true), 0);
  const sum48 = { a: 4.8 };
  assert.ok(Math.abs(entropyValue(sum48) - 0.097) < 0.001);
});

test("net value subtracts entropy unless cured", () => {
  const gross = Math.log(1.15) * 1.5;
  assert.ok(Math.abs(netValue(BITWIRE, WEIGHTS) - (Math.log(1.05) * 1.5 - entropyValue(WEIGHTS))) < 1e-9);
  assert.ok(netValue(BITWIRE, WEIGHTS) < 0);
  assert.ok(Math.abs(netValue(BITWIRE, WEIGHTS, true) - Math.log(1.05) * 1.5) < 1e-9);
  assert.ok(gross > 0);
});

test("buildCatalog assembles rows and skips errors and missing data", () => {
  const rows = buildCatalog(["A", "B", "C", "D"],
    { A: SPTN, B: { error: "x" }, C: SPINE },
    { A: [], C: ["A"] },
    { A: 100, B: 5, C: 50, D: 7 },
    { A: 3600000, B: 1, C: 7200000, D: 1 });
  assert.deepEqual(rows.map(r => r.name), ["A", "C"]);
  assert.equal(rows[0].hours, 1);
  assert.equal(rows[1].hours, 2);
  assert.deepEqual(rows[1].prereqs, ["A"]);
  assert.equal(rows[1].graftPrice, 50);
});

const ROWS = buildCatalog(
  ["SPTN-97 Gene Modification", "Bionic Spine", "Graphene Bionic Spine Upgrade", "BitWire", "QLink", "violet Congruity Implant"],
  { "SPTN-97 Gene Modification": SPTN, "Bionic Spine": SPINE, "Graphene Bionic Spine Upgrade": G_SPINE, BitWire: BITWIRE, QLink: QLINK, "violet Congruity Implant": CURE },
  { "Graphene Bionic Spine Upgrade": ["Bionic Spine"] },
  { "SPTN-97 Gene Modification": 14.6e9, "Bionic Spine": 0.38e9, "Graphene Bionic Spine Upgrade": 18e9, BitWire: 0.03e9, QLink: 75e12, "violet Congruity Implant": 150e12 },
  { "SPTN-97 Gene Modification": 5825081, "Bionic Spine": 4462186, "Graphene Bionic Spine Upgrade": 5700000, BitWire: 942090, QLink: 6371372, "violet Congruity Implant": 900000 });

const base = over => ({ catalog: ROWS, owned: [], queued: [], cash: 1e12, entropy: 0, cured: false, weights: WEIGHTS,
  config: { dry: true }, karma: null, karmaTarget: null, playerKarmaShare: 0, alternativeRate: null, installPlanCost: 0,
  installSoonHours: null, factionOffers: null, batchSize: 0, lastFinishedAt: null, now: 1e9, working: null, ...over });

const names = plan => plan.rejected.map(r => r.name + ":" + r.reason);

test("default config is dry and enabled", () => {
  assert.equal(DEFAULT_GRAFT_CONFIG.dry, true);
  assert.equal(DEFAULT_GRAFT_CONFIG.enabled, true);
  assert.equal(DEFAULT_GRAFT_CONFIG.maxPriceFractionOfCash, 0.25);
});

test("a good candidate returns the pick with its numbers and ranks by value per hour", () => {
  const plan = planGraft(base({}));
  assert.ok(plan.pick);
  assert.ok(plan.pick.netV > 0.05);
  assert.ok(plan.pick.rateV > 0);
  const rates = plan.candidates.map(c => c.rateV);
  assert.deepEqual(rates, [...rates].sort((a, b) => b - a));
  assert.equal(plan.pick.name, plan.candidates[0].name);
  assert.equal(plan.pick.name, "SPTN-97 Gene Modification");
  assert.ok(plan.reasons.length >= 1);
});

test("gate: disabled", () => {
  const plan = planGraft(base({ config: { enabled: false } }));
  assert.equal(plan.pick, null);
  assert.deepEqual(plan.blocked, ["disabled"]);
});

test("gate: already grafting", () => {
  const plan = planGraft(base({ working: { type: "GRAFTING" } }));
  assert.equal(plan.pick, null);
  assert.deepEqual(plan.blocked, ["already grafting"]);
});

test("gate: entropy cap, lifted when cured", () => {
  const plan = planGraft(base({ entropy: 6 }));
  assert.deepEqual(plan.blocked, ["entropy cap"]);
  assert.ok(planGraft(base({ entropy: 6, cured: true })).pick);
});

test("gate: allow and block lists", () => {
  assert.equal(planGraft(base({ config: { allow: ["QLink"] }, cash: 1e15 })).pick.name, "QLink");
  const blocked = planGraft(base({ config: { block: ["SPTN-97 Gene Modification"] } }));
  assert.notEqual(blocked.pick.name, "SPTN-97 Gene Modification");
  assert.ok(!blocked.candidates.some(c => c.name === "SPTN-97 Gene Modification"));
});

test("gate: prereqs missing, and the chain picks Bionic Spine before Graphene Bionic Spine", () => {
  const only = { allow: ["Graphene Bionic Spine Upgrade", "Bionic Spine"] };
  const first = planGraft(base({ config: only }));
  assert.equal(first.pick.name, "Bionic Spine");
  assert.ok(names(first).includes("Graphene Bionic Spine Upgrade:prereqs missing"));
  const second = planGraft(base({ config: only, owned: ["Bionic Spine"] }));
  assert.equal(second.pick.name, "Graphene Bionic Spine Upgrade");
  const alone = planGraft(base({ config: { allow: ["Graphene Bionic Spine Upgrade"] } }));
  assert.equal(alone.pick, null);
  assert.deepEqual(alone.blocked, ["prereqs missing"]);
});

test("queued augmentations count as prereqs but do not change the graft price", () => {
  const plain = planGraft(base({ config: { allow: ["Graphene Bionic Spine Upgrade"] }, queued: ["Bionic Spine"] }));
  assert.equal(plain.pick.name, "Graphene Bionic Spine Upgrade");
  assert.equal(plain.pick.price, 18e9);
  const ladder = planGraft(base({ config: { allow: ["Graphene Bionic Spine Upgrade"] }, queued: ["Bionic Spine", "x1", "x2", "x3", "x4", "x5"], batchSize: 6 }));
  assert.equal(ladder.pick.price, 18e9);
});

test("gate: price cap", () => {
  const plan = planGraft(base({ cash: 40e9, config: { allow: ["SPTN-97 Gene Modification"] } }));
  assert.equal(plan.pick, null);
  assert.deepEqual(plan.blocked, ["price cap"]);
  assert.ok(planGraft(base({ cash: 60e9, config: { allow: ["SPTN-97 Gene Modification"] } })).pick);
});

test("gate: install-plan reserve", () => {
  const args = { cash: 100e9, installPlanCost: 95e9, config: { allow: ["SPTN-97 Gene Modification"], maxPriceFractionOfCash: 1 } };
  const plan = planGraft(base(args));
  assert.deepEqual(plan.blocked, ["install-plan reserve"]);
  const off = planGraft(base({ ...args, config: { ...args.config, reserveInstallPlan: false } }));
  assert.ok(off.pick);
});

test("gate: karma phase (no graft in stage 1), allowed only when the delay is small", () => {
  const stage1 = base({ config: { allow: ["SPTN-97 Gene Modification"] }, karma: -1000, karmaTarget: -54000, playerKarmaShare: 0.5 });
  const plan = planGraft(stage1);
  assert.equal(plan.pick, null);
  assert.deepEqual(plan.blocked, ["karma phase"]);
  const smallShare = { ...stage1, playerKarmaShare: 0.01, config: { allow: ["SPTN-97 Gene Modification"], allowDuringKarma: true } };
  assert.ok(planGraft(smallShare).pick);
  const notAllowed = { ...stage1, playerKarmaShare: 0.01 };
  assert.equal(planGraft(notAllowed).pick, null);
  const bigShare = { ...stage1, playerKarmaShare: 0.5, config: { allow: ["SPTN-97 Gene Modification"], allowDuringKarma: true } };
  assert.equal(planGraft(bigShare).pick, null);
  assert.ok(planGraft(base({ config: { allow: ["SPTN-97 Gene Modification"] }, karma: -60000, karmaTarget: -54000, playerKarmaShare: 0.5 })).pick);
});

test("gate: cheaper via faction uses the stepped price with rep ready", () => {
  const cfg = { allow: ["Bionic Spine"] };
  const cheap = planGraft(base({ config: cfg, factionOffers: { "Bionic Spine": { price: 0.1e9, repReady: true } }, batchSize: 1 }));
  assert.deepEqual(cheap.blocked, ["cheaper via faction"]);
  const stepped = planGraft(base({ config: cfg, factionOffers: { "Bionic Spine": { price: 0.1e9, repReady: true } }, batchSize: 5 }));
  assert.ok(stepped.pick);
  const noRep = planGraft(base({ config: cfg, factionOffers: [{ name: "Bionic Spine", price: 0.1e9, repReady: false }] }));
  assert.ok(noRep.pick);
});

test("gate: net value (small hacking augs and the cure are not worth an entropy stack)", () => {
  const plan = planGraft(base({ cash: 1e15, config: { allow: ["BitWire", "violet Congruity Implant"] } }));
  assert.equal(plan.pick, null);
  assert.deepEqual(plan.blocked, ["net value"]);
});

test("gate: max graft hours, and unfocused speed lengthens the time", () => {
  const cfg = { allow: ["QLink"], maxGraftHours: 1.7 };
  const plan = planGraft(base({ cash: 1e15, config: cfg }));
  assert.deepEqual(plan.blocked, ["max graft hours"]);
  const sptn = { allow: ["SPTN-97 Gene Modification"], maxGraftHours: 1.7 };
  assert.ok(planGraft(base({ config: { ...sptn, focus: true } })).pick);
  assert.equal(planGraft(base({ config: { ...sptn, focus: false } })).pick, null);
  assert.ok(planGraft(base({ config: { ...sptn, focus: false }, owned: ["Neuroreceptor Management Implant"] })).pick);
});

test("gate: rate must beat the alternative when one is given", () => {
  const free = planGraft(base({}));
  const rate = free.pick.rateV;
  assert.ok(planGraft(base({ alternativeRate: rate * 0.5 })).pick);
  const plan = planGraft(base({ config: { allow: ["SPTN-97 Gene Modification"] }, alternativeRate: 1000 }));
  assert.equal(plan.pick, null);
  assert.deepEqual(plan.blocked, ["rate below alternative"]);
});

test("gate: cooldown after a finished graft", () => {
  const plan = planGraft(base({ config: { allow: ["SPTN-97 Gene Modification"] }, lastFinishedAt: 1e9 - 1000 }));
  assert.deepEqual(plan.blocked, ["cooldown"]);
  assert.ok(planGraft(base({ lastFinishedAt: 1e9 - 700000 })).pick);
});

test("gate: install imminent", () => {
  const plan = planGraft(base({ config: { allow: ["SPTN-97 Gene Modification"] }, installSoonHours: 0.5 }));
  assert.deepEqual(plan.blocked, ["install imminent"]);
  assert.ok(planGraft(base({ installSoonHours: 10 })).pick);
});

test("owned and queued augmentations are never candidates", () => {
  const plan = planGraft(base({ owned: ["SPTN-97 Gene Modification"], queued: ["QLink"] }));
  assert.ok(!plan.candidates.some(c => c.name === "SPTN-97 Gene Modification" || c.name === "QLink"));
});

test("installBlocked only while a fresh status owns the player", () => {
  const now = 1e9;
  assert.equal(installBlocked({ ownsPlayer: true, ts: now - 1000 }, now), true);
  assert.equal(installBlocked({ ownsPlayer: true, ts: now - 130000 }, now), false);
  assert.equal(installBlocked({ ownsPlayer: false, ts: now }, now), false);
  assert.equal(installBlocked(null, now), false);
  assert.equal(installBlocked({ ownsPlayer: true, ts: now - 5000 }, now, 1000), false);
});

test("rankCatalog: SPTN-97 first among no-prereq combat augs; filters apply", async () => {
  const { rankCatalog, isCombatAug } = await import("./graft_logic.js");
  const combat = rankCatalog(ROWS, WEIGHTS, { noPrereqs: true, combat: true });
  assert.equal(combat[0].name, "SPTN-97 Gene Modification");
  assert.ok(!combat.some(r => r.name === "Graphene Bionic Spine Upgrade"));
  assert.ok(!combat.some(r => r.name === "BitWire" || r.name === "QLink"));
  assert.equal(isCombatAug(SPINE), true);
  assert.equal(isCombatAug(BITWIRE), false);
  const all = rankCatalog(ROWS, WEIGHTS);
  assert.equal(all.length, ROWS.length);
  for (let i = 1; i < all.length; i++) assert.ok(all[i - 1].perHour >= all[i].perHour);
});

test("graftInputs builds planGraft input from status files (G5 dry controller)", async () => {
  const { graftInputs, decisionKey } = await import("./graft_logic.js");
  const files = {
    catalog: { rows: ROWS },
    readiness: {
      owned: ["Bionic Spine"], queued: [],
      offers: [
        { name: "BitWire", faction: "A", rep: 10, repRequired: 100, price: 5e6 },
        { name: "BitWire", faction: "B", rep: 500, repRequired: 100, price: 9e6 },
      ],
      advice: { verdict: "wait", average: 0.016, next: { rate: 0.078 } },
      installPlan: { names: ["x", "y", "z"], cost: 3.35e9 },
    },
    sleeve: { karma: -65000, karmaTarget: -54000 },
    activity: { currentWork: { type: "FACTION" } },
    target: { augWeights: WEIGHTS },
    config: { dry: true },
    previous: { lastFinishedAt: 123 },
  };
  const input = graftInputs(files, { cash: 3.4e9, entropy: 0, now: 5 });
  assert.equal(input.catalog.length, ROWS.length);
  assert.equal(input.alternativeRate, 0.078);
  assert.equal(input.installPlanCost, 3.35e9);
  assert.equal(input.batchSize, 3);
  assert.equal(input.installSoonHours, null);
  assert.deepEqual(input.factionOffers.BitWire, { price: 9e6, repReady: true });
  assert.equal(input.lastFinishedAt, 123);
  assert.equal(input.cured, false);
  assert.equal(input.weights, WEIGHTS);
  // Live numbers today: $3.4b against a $3.35b plan, so every graft is refused (reserve or price cap).
  const plan = planGraft(input);
  assert.equal(plan.pick, null);
  assert.ok(plan.blocked.includes("price cap") || plan.blocked.includes("install-plan reserve"));
  assert.ok(decisionKey(plan).startsWith("blocked:"));
  // An install verdict means install now; empty files give a safe empty input.
  files.readiness.advice.verdict = "install";
  assert.equal(graftInputs(files, { cash: 1 }).installSoonHours, 0);
  const empty = graftInputs({}, {});
  assert.equal(empty.catalog.length, 0);
  assert.equal(empty.alternativeRate, null);
  assert.equal(planGraft(empty).pick, null);
  assert.equal(decisionKey(planGraft(base({}))), `pick:${planGraft(base({})).pick.name}`);
});
