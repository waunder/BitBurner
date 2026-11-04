/**
 * Choose a gang capital policy from the terminal.
 * Run: run select_gang_policy.js
 */
const POLICY_FILE = "gang_capital_policy.json";
const POLICIES = [
  {
    phase: "progression",
    objective: "Preserve capital for general progression; stop gang equipment purchases",
    allowEquipmentPurchases: false,
    augmentationCashTarget: null,
  },
  {
    phase: "earning-capacity",
    objective: "Build gang earning capacity with measured-payback equipment",
    allowEquipmentPurchases: true,
    augmentationCashTarget: null,
  },
  {
    phase: "augmentation",
    objective: "Accumulate cash toward optional QLink while prioritizing BN2 hacking progression; stop gang equipment purchases",
    allowEquipmentPurchases: false,
    augmentationCashTarget: null,
  },
];

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.closeTail(ns.pid);

  const current = readPolicy(ns);
  ns.tprint("Gang capital policy selector");
  ns.tprint(`Current: ${current.phase} — ${current.allowEquipmentPurchases ? "equipment buying enabled" : "equipment buying disabled"}`);
  for (let i = 0; i < POLICIES.length; i++) {
    const policy = POLICIES[i];
    ns.tprint(`${i + 1}. ${policy.phase} — ${policy.objective}`);
  }
  ns.tprint("0. Cancel");

  const choice = await ns.prompt("Select gang capital policy", {
    type: "select",
    choices: ["1. progression (no equipment)", "2. earning-capacity (equipment allowed)", "3. augmentation (no equipment)", "0. cancel"],
  });
  if (choice === false || choice === "0. cancel") {
    ns.tprint("Policy unchanged.");
    return;
  }

  const index = Number.parseInt(String(choice), 10) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= POLICIES.length) {
    ns.tprint("Unrecognized choice; policy unchanged.");
    return;
  }

  // Capital-phase selection must not silently override the independent,
  // explicit territory opt-in stored in this shared policy file.
  const selected = { ...POLICIES[index], territoryEnabled: current.territoryEnabled === true,
    updatedAt: new Date().toISOString().slice(0, 10) };
  await ns.write(POLICY_FILE, JSON.stringify(selected, null, 2) + "\n", "w");
  const written = readPolicy(ns);
  if (written.phase !== selected.phase
      || written.allowEquipmentPurchases !== selected.allowEquipmentPurchases
      || written.territoryEnabled !== selected.territoryEnabled) {
    ns.tprint(`Could not verify ${POLICY_FILE}; check the policy file before relying on the selection.`);
    return;
  }
  ns.tprint(`Selected ${selected.phase}. Equipment purchases ${selected.allowEquipmentPurchases ? "enabled (controller ROI limits still apply)" : "disabled"}.`);
  ns.tprint("gang-controller.js reads this policy during its normal loop; no restart is needed.");
}

function readPolicy(ns) {
  try {
    return JSON.parse(ns.read(POLICY_FILE) || "{}");
  } catch {
    return { phase: "unknown", allowEquipmentPurchases: false };
  }
}
