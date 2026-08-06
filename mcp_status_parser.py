import json
from pathlib import Path

STATUS_FILE = Path(__file__).resolve().parent / 'mcp_status.json'

def fmt_num(value):
    if not isinstance(value, (int, float)):
        return str(value)
    if value >= 1e12:
        return f'{value/1e12:.2f}T'
    if value >= 1e9:
        return f'{value/1e9:.2f}B'
    if value >= 1e6:
        return f'{value/1e6:.2f}M'
    if value >= 1e3:
        return f'{value/1e3:.2f}K'
    return f'{value:.2f}'


def main():
    if not STATUS_FILE.exists():
        print(f'Status file not found: {STATUS_FILE}')
        return

    status = json.loads(STATUS_FILE.read_text())
    print('mcp status parser')
    print('==================')
    print(f"timestamp:        {status['ts']} ({status['ts'] and __import__('datetime').datetime.utcfromtimestamp(status['ts']/1000).isoformat()+'Z'})")
    print(f"target:           {status.get('target')}")
    print(f"plan:             {status.get('plan')}")
    print(f"sec:              {status.get('currentSecurity', 0):.2f}")
    print(f"moneyPct:         {status.get('moneyPct', 0):.3f}")
    print(f"needWeaken:       {status.get('needWeaken')}")
    print(f"maxWeaken:        {status.get('maxWeaken')}")
    print(f"homeFreeRam:      {status.get('homeFreeRam', 0):.2f} GB")
    print(f"hacked:           {fmt_num(status.get('hacked', 0))}")
    print(f"rate:             {fmt_num(status.get('rate', 0))}/s")
    print(f"avgRate:          {fmt_num(status.get('avgRate', 0))}/s")
    print(f"totalHacked:      {fmt_num(status.get('totalHacked', 0))}")
    print(f"workers:          {len(status.get('workers', []))}")
    print(f"candidate:        {status.get('candidate')}")
    print(f"candidateScore:   {fmt_num(status.get('candidateScore', 0))}")
    print(f"expectedIncome:   {fmt_num(status.get('candidateExpectedIncome', 0))}/s")
    print('\nworkers:')
    for worker in status.get('workers', []):
        actions = worker.get('actions') or []
        action_str = ', '.join(f"{a['script']}({a['threads']})" for a in actions) or 'idle'
        print(f"  - {worker['host']}: freeRam={worker.get('freeRam',0):.2f} GB usedRam={worker.get('usedRam',0):.2f} GB maxRam={worker.get('maxRam',0):.2f} GB actions={action_str}")


if __name__ == '__main__':
    main()
