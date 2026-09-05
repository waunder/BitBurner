/**
 * Prints the connect-chain from home to `target` (BFS over ns.scan) so it
 * can be typed as terminal `connect` commands. Deliberately uses no
 * Singularity functions -- see hacking/backdoor.js's note on why: without
 * Source-File 4, ns.singularity.* (including connect/installBackdoor)
 * throws at the call site, but plain ns.scan is never gated.
 *
 * Also prints a single semicolon-chained PASTE line (added 2026-09-04, Ken's
 * ask): Bitburner's terminal accepts multiple `;`-separated commands typed
 * as one line (confirmed working this way 2026-08-11 for a real
 * connect-chain + backdoor), so this is one paste instead of typing each
 * hop as a separate command. This is genuinely the closest thing to an
 * automated walk available without Source-File 4 -- there's no ungated
 * Netscript function that moves the terminal's connection itself, only
 * ns.singularity.connect (gated) or typing/pasting connect commands
 * directly, which is what this line is for.
 *
 * Starts with a plain `home` command so the chain works regardless of
 * where the terminal is currently connected, not just when already at home.
 *
 * @param {NS} ns
 */
export async function main(ns) {
	const target = ns.args[0]
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
	if (!(target in parent)) {
		ns.tprint("findpath.js: no path from home to ", target)
		return
	}
	let path = []
	for (let node = target; node !== null; node = parent[node]) {
		path.unshift(node)
	}
	ns.tprint("PATH: ", path.join(" -> "))
	if (path.length === 1) {
		ns.tprint("PASTE: home  (target is home itself)")
	} else {
		const hops = path.slice(1).map((hop) => `connect ${hop}`)
		ns.tprint("PASTE: ", ["home", ...hops].join(";"))
	}
}
