/**
 * Installs a backdoor on `target`, connecting there from home first (only
 * `ns.singularity.connect` can move the terminal's connection, and it only
 * hops to direct neighbours, so the walk has to happen one server at a
 * time). Invoked by `hacking/worm.js` after a successful nuke against the
 * four faction-gateway servers (CSEC, avmnite-02h, I.I.I.I, run4theh111z) --
 * this file was previously missing, so that exec silently failed every time.
 *
 * @param {NS} ns
 */
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
	if (ns.getServer(target).backdoorInstalled) {
		ns.print(target, " already backdoored, nothing to do")
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
