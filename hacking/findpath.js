/**
 * Prints the connect-chain from home to `target` (BFS over ns.scan) so it
 * can be typed as terminal `connect` commands. Deliberately uses no
 * Singularity functions -- see hacking/backdoor.js's note on why: without
 * Source-File 4, ns.singularity.* (including connect/installBackdoor)
 * throws at the call site, but plain ns.scan is never gated.
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
}
