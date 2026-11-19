# Aurora R16 GPU Reset Summary

Nov 14, 2026 · Ken Howard

Live copy: https://claude.ai/artifact/EGiwZLod66ZvSn32WVfmcE

The RTX 4070 Ti driver resets the card hundreds of times a day, triggered by ordinary window and display changes. Every software fix tried so far has failed, so we suspect the card or its power.

## The PC

| Part | Detail |
| --- | --- |
| Model | Alienware Aurora R16, BIOS 2.25.0 |
| CPU | Intel Core i9-13900F (microcode 0x133) |
| RAM | 64 GB |
| GPU | NVIDIA GeForce RTX 4070 Ti, Dell OEM (VBIOS 95.04.3c.08.63), 285 W limit |
| Driver | NVIDIA Studio 621.24 (was 610.60 until 2026-11-14) |
| Monitor | ASUS ROG PG279Q |
| OS | Windows 11 Pro |

## Symptom

The screen flickers, goes black or stalls for seconds while the NVIDIA driver resets the GPU, usually in bursts of 10 to 40 resets within a minute. The Windows System log recorded 993 resets on 2026-11-14 alone.

- **Event IDs:** nvlddmkm 153 (reset/recovery), 14, and 13 with Xid 13 "Graphics SM Warp Exception": Out Of Range Register, Shader Program Header error, ILLEGAL_OPCODE.
- **Triggers:** opening or switching windows (Win+R, a terminal, a game window), switching full screen, display mode changes. It also happens with the PC idle and nobody at it (11:53 and 11:57 on 2026-11-14).
- **Hard freezes and unexpected reboots** (Kernel-Power 41): 2026-10-29, 2026-11-07, and three on 2026-11-14 (08:57, 09:02, 14:49).
- **Not heat or power limits:** temperatures, power draw and throttle reasons all looked normal. The GPU idles around 32 °C.

## When it started

The trouble began on 2026-10-29; the System log runs back to 2026-06-24 and shows only one unexplained reboot (2026-07-01) before that. GPU resets were first logged on 2026-11-11, eight hours after a Windows security update.

| Date | What happened |
| --- | --- |
| 2026-11-14 | 993 resets; NVIDIA driver changed twice (610.60, then Studio 621.24) |
| 2026-11-13 | Intel driver update (16:01); Mixed Reality Link update (23:41) |
| 2026-11-11 | First 5 logged resets at 09:47, after security update KB5132061 at 01:33 |
| 2026-11-07 | Hard freeze, unexpected reboot |
| 2026-10-31 | Windows 11 feature update to 26H2 (build 26300) |
| 2026-10-29 | First hard freeze (15:24); Mixed Reality Link installed or updated 16:14 |

The 26H2 update can no longer be rolled back: Windows' 10-day undo window has passed and C:\Windows.old is gone. There are no System Restore points (System Restore was never on).

## Already tried

None of these stopped the resets. All were done on 2026-11-14 unless noted.

| Change | Result |
| --- | --- |
| Dell pre-boot diagnostics (F12): Quick Test and Advanced Video Test | All passed; these run before Windows loads the NVIDIA driver |
| Meta Quest software (Mixed Reality Link) fully disabled from boot | Resets returned 10 min after boot: 38 at 21:50–21:51 |
| Multiplane overlay (MPO) off, OverlayTestMode=5 | Resets continued straight after reboot |
| PCIe link power saving (ASPM) off | Unexpected reboot 35 min later, resets continued |
| Clean install of NVIDIA Studio 621.24 (from 610.60) | Same errors on both drivers |
| Immersed and Virtual Desktop services disabled | No change |
| Display power-off set to Never | No change |

## Reproducing it and what we're asking

To see it: open and close a few windows, press Win+R, or open a terminal. It usually shows within minutes. Event Viewer > Windows Logs > System, filtered to source **nvlddmkm**, shows each reset with a timestamp.

What we'd like checked:

1. Reseat the graphics card and its 16-pin (12VHPWR) power connector, and look for heat damage on the plug.
2. Check the power supply under load.
3. Swap test: this card in another PC, or a known-good card in this PC. This is the step that settles card versus the rest. (The i9-13900F has no integrated graphics, and we have no spare card.)
4. A GPU memory stress test under Windows (for example OCCT's VRAM test), since the Dell tests skip the driver.

One software variable remains: Meta's Quest Link app (OVRService and its "Meta Virtual Monitor" driver) is still installed. A clean Windows boot without it, or the swap test, would rule it out.

## Tomorrow (Ken + Claude, before MemoryExpress)

- Uninstall security update KB5132061 as a test (`wusa /uninstall /kb:5132061`, admin, restart).
- Stop/disable Meta's OVRService (admin) and see whether resets continue.
- Clock test (minimizing a window also triggers resets, 2026-11-14 ~22:20): NVIDIA Control Panel > Manage 3D settings > Power management mode = "Prefer maximum performance" (global), or `nvidia-smi -lgc 1500,2600` (admin; undo `nvidia-smi -rgc`). If resets stop, the card is unstable when dropping to/rising from idle clocks.
- Turn on System Restore for C: so there is a fallback.
- Photos or video of the 16-pin power connector via iPhone.
- Undo MPO test when done: `reg delete HKLM\SOFTWARE\Microsoft\Windows\Dwm /v OverlayTestMode /f` + restart.

## Update 2026-11-19: stable for days, then two hard crashes

- Stable stretch: the 11-15 14:17 boot ran almost four days with only a handful of resets (4 on 11-15/16, 0 on 11-16/17, 1 each on 11-16 11:48 and 11-18 16:54, 3 at 11-19 07:00). Idle 31 °C, ~3 W. Reseat not done yet.
- Then, while Ken was noting how stable it had been: **unexpected shutdown at 07:52:33** (Kernel-Power 41, no log entries before it, so a hard freeze), reboot 08:16; resets began the moment the desktop came up (08:16:23).
- **Second hard crash** at ~08:20 (Kernel-Power 41, boot 08:20:52), then ~250 resets 08:21-08:23 (63x Xid 13, 9x 14, 222x 153 across both boots). Game relaunched 08:22.
- The quiet watch could not alert: a hard freeze kills it before it can count anything.
- Reads as: the card's fault is intermittent, not gone. Long quiet stretches do not mean it is healed. Same pattern as 11-14: a crash, then bursts right after each boot.
