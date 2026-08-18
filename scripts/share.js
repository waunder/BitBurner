/** @param {NS} ns */
const POLL_MS = 1000

export async function main(ns) {
	while (true) {
		await ns.share()
		// ns.share() is not a reliable scheduler yield. Keep every worker from
		// monopolising the game event loop when many share threads are deployed.
		await ns.sleep(POLL_MS)
	}
}
