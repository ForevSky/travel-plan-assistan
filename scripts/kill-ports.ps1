# 清理项目常用端口占用（8000 后端 / 5173 前端）
param(
    [int[]] $Ports = @(8000, 5173)
)

foreach ($port in $Ports) {
    $connections = netstat -ano | Select-String ":$port\s" | Select-String "LISTENING"
    $pids = $connections | ForEach-Object {
        ($_ -split "\s+")[-1]
    } | Sort-Object -Unique

    if (-not $pids) {
        Write-Host "端口 $port 未被占用"
        continue
    }

    foreach ($procId in $pids) {
        if ($procId -match "^\d+$" -and [int]$procId -gt 0) {
            Write-Host "终止端口 $port 上的进程 PID=$procId"
            taskkill /F /PID $procId 2>$null
        }
    }
}

Write-Host "端口清理完成"
