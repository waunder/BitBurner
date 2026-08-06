/** @param {NS} ns */
export async function main(ns) {
	let server = ns.args[0];
	ns.scp('/scripts/grow.js', server)
	ns.scp('/scripts/hack.js', server)
	ns.scp('/scripts/weaken.js', server)
}