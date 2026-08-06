/** @param {NS} ns */
export async function main(ns) {
    // How much RAM each cloud server will have. In this case, it'll be 8GB.
    const ram = 8;

    // Iterator we'll use for our loop
    let i = ns.cloud.getServerNames().length;

    // Continuously try to purchase cloud servers until we've reached the maximum
    // amount of servers
    while (i < ns.cloud.getServerLimit()) {
        // Check if we have enough money to purchase access to a server
        if (ns.getServerMoneyAvailable("home") > ns.cloud.getServerCost(ram)) {
            // If we have enough money, then:
            //  1. Purchase the server
            //  2. Copy our hacking script onto the newly purchased cloud server
            //  3. Run our hacking script on the newly purchased cloud server with 3 threads
            //  4. Increment our iterator to indicate that we've bought a new server
            const hostname = ns.cloud.purchaseServer("cloud-server-" + i, ram);
            ns.scp("early-hack-template.js", hostname);
            ns.exec("early-hack-template.js", hostname, 3);
            ++i;
        }
        // Make the script wait for a second before looping again.
        // Removing this line will cause an infinite loop and crash the game.
        await ns.sleep(1000);
    }
}