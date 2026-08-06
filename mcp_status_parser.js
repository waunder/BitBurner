#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const STATUS_FILE = path.resolve(__dirname, 'mcp_status.json');

function loadStatus() {
  if (!fs.existsSync(STATUS_FILE)) {
    console.error(`Status file not found: ${STATUS_FILE}`);
    process.exit(1);
  }
  const text = fs.readFileSync(STATUS_FILE, 'utf8');
  return JSON.parse(text);
}

function formatNumber(value) {
  if (typeof value !== 'number') return String(value);
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
}

function main() {
  const status = loadStatus();
  console.log('mcp status parser');
  console.log('==================');
  console.log(`timestamp:   ${new Date(status.ts).toISOString()}`);
  console.log(`target:      ${status.target}`);
  console.log(`plan:        ${status.plan}`);
  console.log(`sec:         ${status.currentSecurity.toFixed(2)}`);
  console.log(`moneyPct:    ${status.moneyPct.toFixed(3)}`);
  console.log(`needWeaken:  ${status.needWeaken}`);
  console.log(`maxWeaken:   ${status.maxWeaken}`);
  console.log(`homeFreeRam: ${status.homeFreeRam.toFixed(2)} GB`);
  console.log(`hacked:      ${formatNumber(status.hacked)}`);
  console.log(`rate:        ${formatNumber(status.rate)}/s`);
  console.log(`avgRate:     ${formatNumber(status.avgRate)}/s`);
  console.log(`total:       ${formatNumber(status.totalHacked)}`);
  console.log(`workers:     ${status.workers.length}`);
  console.log(`candidate:   ${status.candidate}`);
  console.log(`candidateScore: ${formatNumber(status.candidateScore)}`);
  console.log(`expectedIncome: ${formatNumber(status.candidateExpectedIncome)}/s`);
  console.log('');
  console.log('workers:');
  for (const worker of status.workers) {
    const actions = worker.actions && worker.actions.length > 0
      ? worker.actions.map(a => `${a.script}(${a.threads})`).join(', ')
      : 'idle'
    console.log(`  - ${worker.host}: freeRam=${worker.freeRam.toFixed(2)} GB usedRam=${worker.usedRam.toFixed(2)} GB maxRam=${worker.maxRam.toFixed(2)} GB actions=${actions}`);
  }
}

main();
