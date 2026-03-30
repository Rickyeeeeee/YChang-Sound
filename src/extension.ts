import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

let disposable: vscode.Disposable | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('[YChang Sound] Extension activated');

    // Listen for terminal command completions (requires Shell Integration)
    disposable = vscode.window.onDidEndTerminalShellExecution((event) => {
        const config = vscode.workspace.getConfiguration('ychang-sound');
        const enabled = config.get<boolean>('enabled', true);

        if (!enabled) {
            return;
        }

        // exitCode: 0 = success, non-zero = failure, undefined = unknown/forced close
        const exitCode = event.exitCode;

        if (exitCode !== undefined && exitCode !== 0) {
            playErrorSound(context);
        }
    });

    context.subscriptions.push(disposable);

    // Register a test command so users can preview the sound
    const testCmd = vscode.commands.registerCommand('ychang-sound.testSound', () => {
        playErrorSound(context);
    });
    context.subscriptions.push(testCmd);
}

function playErrorSound(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('ychang-sound');
    // const soundFile = config.get<string>('soundFile', 'error.mp3');
    const soundFile = config.get<string>('soundFile', 'YChang-sunny.m4a');
    const soundPath = path.join(context.extensionPath, 'sounds', soundFile);

    // Check if file exists
    if (!fs.existsSync(soundPath)) {
        vscode.window.showWarningMessage(
            `YChang Sound: Sound file "${soundFile}" not found in the sounds/ folder. ` +
            `Please place your sound clip there.`
        );
        return;
    }

    // Use platform-native audio playback (no external dependencies needed)
    const platform = process.platform;
    let command: string;

    if (platform === 'win32') {
        // PowerShell: use .NET MediaPlayer for robust MP3/WAV playback
        const escapedPath = soundPath.replace(/'/g, "''");
        command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName PresentationCore; $p = New-Object System.Windows.Media.MediaPlayer; $p.Open('${escapedPath}'); $p.Play(); Start-Sleep -Seconds 5"`;
    } else if (platform === 'darwin') {
        // macOS: afplay is built-in
        command = `afplay "${soundPath}"`;
    } else {
        // Linux: try aplay for wav, mpg123/paplay as fallbacks
        const ext = path.extname(soundPath).toLowerCase();
        if (ext === '.wav') {
            command = `aplay "${soundPath}"`;
        } else {
            command = `mpg123 "${soundPath}" 2>/dev/null || paplay "${soundPath}" 2>/dev/null || mplayer "${soundPath}" 2>/dev/null`;
        }
    }

    exec(command, (err) => {
        if (err) {
            console.error(`[YChang Sound] Failed to play sound: ${err.message}`);
        }
    });
}

export function deactivate() {
    if (disposable) {
        disposable.dispose();
    }
}
