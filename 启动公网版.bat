@echo off
chcp 65001 >nul
title NISP 刷题站 - 公网启动器
cd /d "%~dp0"

set MYSQLD=D:\MySQL\bin\mysqld.exe
set MYINI=D:\MySQL\my.ini
set SSH=C:\Windows\System32\OpenSSH\ssh.exe

echo ============================================
echo    NISP 刷题站 - 一键启动（公网可访问）
echo ============================================
echo.

echo [1/3] 检查 MySQL 数据库 ...
tasklist /FI "IMAGENAME eq mysqld.exe" 2>nul | find /i "mysqld.exe" >nul
if errorlevel 1 (
    if exist "%MYSQLD%" (
        echo       正在启动 MySQL ...
        start "" "%MYSQLD%" --defaults-file="%MYINI%"
        timeout /t 7 /nobreak >nul
    ) else (
        echo       [警告] 找不到 %MYSQLD%，请确认 MySQL 安装路径
    )
) else (
    echo       MySQL 已在运行
)

echo [2/3] 启动网站服务 ...
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul
if errorlevel 1 (
    start "NISP-Server" cmd /k "node server\index.js"
    timeout /t 4 /nobreak >nul
) else (
    echo       3000 端口已被占用，跳过
)

echo [3/3] 启动公网隧道 ...
echo.
echo --------------------------------------------
echo   接下来弹出的窗口里会出现一行：
echo.
echo      https://xxxxxxxxx.lhr.life
echo.
echo   把这行地址复制发给朋友，他们就能用了
echo --------------------------------------------
echo.
start "NISP-Tunnel" cmd /k ""%SSH%" -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL -R 80:localhost:3000 nokey@localhost.run"

echo.
echo 全部启动完成。
echo 本窗口可以直接关闭，不影响服务。
echo 要停止服务：关掉 "NISP-Server" 和 "NISP-Tunnel" 两个窗口。
echo.
pause
