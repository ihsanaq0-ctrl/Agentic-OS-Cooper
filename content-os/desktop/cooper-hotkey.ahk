; Cooper Global Desktop Hotkey (AutoHotkey v1 / v2 compatible)
; Press Win + Shift + C from ANY application on Windows to instantly summon Cooper HUD!

#NoEnv
#SingleInstance Force
SendMode Input
SetWorkingDir %A_ScriptDir%

; Win + Shift + C hotkey
#+c::
    ; If Chrome/Edge with Agentic OS is already open, focus it, otherwise launch app window
    IfWinExist, Agentic OS
    {
        WinActivate, Agentic OS
    }
    Else
    {
        ; Open as a standalone compact app window
        Run, msedge.exe --app="http://localhost:3950"
    }
    Return
