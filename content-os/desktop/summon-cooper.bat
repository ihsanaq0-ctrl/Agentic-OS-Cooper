@echo off
:: Launches Cooper HUD as a sleek standalone borderless app window
start msedge.exe --app="http://localhost:3950" || start chrome.exe --app="http://localhost:3950" || start http://localhost:3950
