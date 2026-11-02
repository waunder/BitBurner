# Run by Ken on the PC. Registers tools/daemon_supervisor.py to start hidden at logon.
$repo = Split-Path $PSScriptRoot -Parent
$name = 'BitBurner daemon supervisor'
$action = New-ScheduledTaskAction -Execute "$repo\.venv\Scripts\pythonw.exe" -Argument 'tools\daemon_supervisor.py' -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Description 'Keeps the BitBurner Remote API daemon running and connected.' -Force | Out-Null
Start-ScheduledTask -TaskName $name
Get-ScheduledTask -TaskName $name | Select-Object TaskName, State
