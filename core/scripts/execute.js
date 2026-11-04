/** @param {NS} ns */
function get_action(ns, host) {
 let actions = ns.ps(host)
 if (actions.length == 0) {
  ns.print(host, " has no scripts.")
  return null
 }
 return actions[0].filename.replace("/scripts/", "").replace(".js", "")
}

/** @param {NS} ns */
function validate(ns, action, server, host) {
 // Does the host exist?
 if (ns.getServer(host) == null) {
  ns.tprint(host + " does not exist. Exiting.")
  ns.exit()
 }

 // Does the server exist?
 if (ns.getServer(server) == null) {
  ns.tprint(server + " does not exist. Exiting.")
  ns.exit()
 }

 if (get_action(ns, host) == action) {
  ns.print(host + " is already executing action " + action)
  ns.exit()
 }
}

/** @param {NS} ns */
export async function main(ns) {
 // Declare our variables
 let action = ns.args[0]
 let server = ns.args[1] //target server
 let host = ns.args[2] //host to run scripts
 if (host == null) {
      host = server
 }
 let script = ""
 // Whats our action?
 if (action == "hack") {
  script = "/scripts/hack.js"
 }
 else if (action == "grow") {
  script = "/scripts/grow.js"
 } else if (action == "weaken") {
  script = "/scripts/weaken.js"
 } else {
  ns.tprint("Script unrecognized. Exiting")
  ns.exit()
 }

 validate(ns, action, server, host)

 ns.killall(host)
 ns.exec("/scripts/copy_scripts.js", "home", 1, host)
 let threads = parseInt(ns.getServerMaxRam(host) / ns.getScriptRam(script))
 if (threads == 0) {
  ns.print(host + " cannot run script. No RAM")
  ns.exit()
 }
 let pid = ns.exec(script, host, threads, server)
 if (pid == 0) {
   await ns.sleep(500)
   ns.exec(script, host, threads, server)
 }
 ns.tprint(action, " executed on ", host, " for ", server, " with ", threads, " threads")
}