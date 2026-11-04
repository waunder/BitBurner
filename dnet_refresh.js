/**
 * One-shot: copies the current darknet scripts from home to every host with a known
 * password. Chains and riders copy files host to host, so after a source change the old
 * copies keep travelling until something replaces them. Running scripts keep the code
 * they loaded; their next exec picks up the new files.
 *
 * Start: run dnet_refresh.js on home. Prints how many hosts took the files.
 * @param {NS} ns
 */
import { readCreds } from "dnet_lib.js"

const FILES = ["dnet_lift.js", "dnet_induce.js", "dnet_rider.js", "dnet_anchor.js", "dnet_scout.js", "dnet_scout_logic.js", "dnet_lib.js", "dnet_feedback.js", "dnet_lab.js", "dnet_lab_logic.js", "dnet_loot.js", "dnet_promote.js"]

export async function main(ns) {
  ns.disableLog("ALL")
  const creds = readCreds(ns)
  let copied = 0
  let refused = 0
  for (const [host, cred] of Object.entries(creds)) {
    try {
      if (!ns.dnet.connectToSession(host, cred.password).success) { refused++; continue }
      if (await ns.scp(FILES, host, "home")) copied++
      else refused++
    } catch { refused++ } // A host can go offline or move between calls.
  }
  ns.tprint(`dnet_refresh: copied to ${copied} hosts, ${refused} refused or unreachable`)
}
