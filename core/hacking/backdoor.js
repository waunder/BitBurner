/**
 * Installs a backdoor on `target`, connecting there from home first (only
 * `ns.singularity.connect` can move the terminal's connection, and it only
 * hops to direct neighbours, so the walk has to happen one server at a
 * time). Invoked by `hacking/worm.js` after a successful nuke against the
 * four faction-gateway servers (CSEC, avmnite-02h, I.I.I.I, run4theh111z) --
 * this file was previously missing, so that exec silently failed every time.
 *
 * **Requires Source-File 4** (all of `ns.singularity.*`, including
 * `connect`/`installBackdoor`, throw an uncaught RUNTIME ERROR without it --
 * confirmed live 2026-08-11, before Ken had SF4). Checked up front and
 * reported as one clear terminal line instead of an uncaught error modal --
 * see `checkSingularityAccess` below. Until SF4 exists, the real fix is
 * typing the same `connect <hop> ... ; backdoor` sequence directly into the
 * terminal by hand (or via Claude's terminal-write path) -- see
 * `docs/processes.md`'s note on this file for the confirmed working
 * workaround and why it isn't automatable yet.
 *
 * @param {NS} ns
 */
function hasSourceFile4(ns) {
	// ns.getResetInfo() is a base-NS call (never Singularity-gated), unlike
	// everything this script actually needs -- safe to call up front to
	// decide whether to even attempt the gated calls below.
	return (ns.getResetInfo().ownedSF.get(4) || 0) > 0
}
function findPathFromHome(ns, target) {
	let queue = ["home"]
	let parent = { home: null }
	while (queue.length > 0) {
		let cur = queue.shift()
		if (cur === target) break
		for (let next of ns.scan(cur)) {
			if (!(next in parent)) {
				parent[next] = cur
				queue.push(next)
			}
		}
	}
	if (!(target in parent)) return null
	let path = []
	for (let node = target; node !== null; node = parent[node]) {
		path.unshift(node)
	}
	return path
}

/** @param {NS} ns */
export async function main(ns) {
	const target = ns.args[0]
	if (!target) {
		ns.tprint("backdoor.js: no target given")
		return
	}
	if (!ns.hasRootAccess(target)) {
		ns.tprint("backdoor.js: no root access to ", target, " yet, nothing to do")
		return
	}
	if (ns.getServer(target).backdoorInstalled) {
		ns.print(target, " already backdoored, nothing to do")
		return
	}
	if (!hasSourceFile4(ns)) {
		ns.tprint(
			"backdoor.js: no Source-File 4 yet, so ns.singularity is unavailable -- ",
			"can't automate this. Type the same steps into the terminal by hand: ",
			"connect through to ", target, ", then run `backdoor`. See docs/processes.md."
		)
		return
	}

	const path = findPathFromHome(ns, target)
	if (!path) {
		ns.tprint("backdoor.js: no path from home to ", target)
		return
	}
	for (const hop of path.slice(1)) {
		ns.singularity.connect(hop)
	}

	ns.tprint("installing backdoor on ", target, "...")
	await ns.singularity.installBackdoor()
	ns.tprint("backdoor installed on ", target)

	ns.singularity.connect("home")
}
