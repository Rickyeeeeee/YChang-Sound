import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import {
    buildSidebarHtml,
    createInitialSlotStats,
    SlotStats,
    spinSlot,
} from './slotgame';

let disposable: vscode.Disposable | undefined;
let soundSidebarView: vscode.WebviewView | undefined;
let slotStats: SlotStats = createInitialSlotStats();

class SoundSidebarViewProvider implements vscode.WebviewViewProvider {
    constructor(private readonly context: vscode.ExtensionContext) {}

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        slotStats = createInitialSlotStats();
        soundSidebarView = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = buildSidebarHtml({
            nonce: getNonce(),
            volume: getConfiguredVolume(),
            stats: slotStats,
        });

        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (message.type === 'playRandom') {
                await vscode.commands.executeCommand('ychang-sound.playRandom');
                return;
            }

            if (message.type === 'playConfigured') {
                await vscode.commands.executeCommand('ychang-sound.playConfigured');
                return;
            }

            if (message.type === 'setVolume') {
                const parsed = Number(message.value);
                const clamped = clampVolume(Number.isFinite(parsed) ? parsed : 1);
                await vscode.workspace
                    .getConfiguration('ychang-sound')
                    .update('volume', clamped, vscode.ConfigurationTarget.Global);
                return;
            }

            if (message.type === 'slotSpinRequest') {
                const result = spinSlot(slotStats);
                slotStats = result.stats;

                if (result.isWin && isSoundEnabled()) {
                    playErrorSound(this.context, true, false);
                }

                webviewView.webview.postMessage({
                    type: 'slotSpinResult',
                    ...result,
                });
            }
        });
    }
}

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

    const testCmd = vscode.commands.registerCommand('ychang-sound.testSound', () => {
        playErrorSound(context);
    });
    context.subscriptions.push(testCmd);

    const playRandomCmd = vscode.commands.registerCommand('ychang-sound.playRandom', () => {
        playErrorSound(context, true);
    });
    context.subscriptions.push(playRandomCmd);

    const playConfiguredCmd = vscode.commands.registerCommand(
        'ychang-sound.playConfigured',
        () => {
            playErrorSound(context, false);
        }
    );
    context.subscriptions.push(playConfiguredCmd);

    const viewProvider = new SoundSidebarViewProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('ychangSoundView', viewProvider)
    );

    const configChange = vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration('ychang-sound.volume')) {
            return;
        }

        const volume = getConfiguredVolume();
        soundSidebarView?.webview.postMessage({
            type: 'volumeUpdated',
            value: volume.toFixed(2),
        });
    });
    context.subscriptions.push(configChange);
}

function playErrorSound(
    context: vscode.ExtensionContext,
    forceRandomize?: boolean,
    showPlayingToast = true
) {
    const config = vscode.workspace.getConfiguration('ychang-sound');
    const randomize = forceRandomize ?? config.get<boolean>('randomize', true);
    const volume = getConfiguredVolume();
    const soundFiles = [
        'YChang-bill.mp3',
        'YChang-jdc.mp3',
        'YChang-sunny.mp3',
        'YChang-yaoting.mp3',
    ];
    const configuredFile = config.get<string>('soundFile', soundFiles[0]);

    const candidateFiles = randomize ? soundFiles : [configuredFile];
    const existingFiles = candidateFiles.filter((file) =>
        fs.existsSync(path.join(context.extensionPath, 'sounds', file))
    );

    if (existingFiles.length === 0) {
        vscode.window.showWarningMessage(
            randomize
                ? 'YChang Sound: No playable random sound files found in the sounds/ folder.'
                : `YChang Sound: Sound file "${configuredFile}" not found in the sounds/ folder.`
        );
        return;
    }

    const soundFile =
        existingFiles[Math.floor(Math.random() * existingFiles.length)];
    const soundPath = path.join(context.extensionPath, 'sounds', soundFile);

    const platform = process.platform;
    let command: string;

    if (platform === 'win32') {
        const escapedPath = soundPath.replace(/'/g, "''");
        command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName PresentationCore; $p = New-Object System.Windows.Media.MediaPlayer; $p.Open('${escapedPath}'); $p.Volume = ${volume.toFixed(2)}; $p.Play(); Start-Sleep -Seconds 5"`;
    } else if (platform === 'darwin') {
        command = `afplay -v ${volume.toFixed(2)} "${soundPath}"`;
    } else {
        const ext = path.extname(soundPath).toLowerCase();
        const mpg123Scale = Math.round(volume * 32768);
        const paplayScale = Math.round(volume * 65536);
        const mplayerScale = Math.round(volume * 100);
        if (ext === '.wav') {
            command = `aplay "${soundPath}"`;
        } else {
            command = `mpg123 -f ${mpg123Scale} "${soundPath}" 2>/dev/null || paplay --volume=${paplayScale} "${soundPath}" 2>/dev/null || mplayer -volume ${mplayerScale} "${soundPath}" 2>/dev/null`;
        }
    }

    if (showPlayingToast) {
        vscode.window.showErrorMessage(`Playing: ${soundFile}`);
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

function getConfiguredVolume(): number {
    const config = vscode.workspace.getConfiguration('ychang-sound');
    const volume = config.get<number>('volume', 1);
    return clampVolume(volume);
}

function clampVolume(value: number): number {
    if (!Number.isFinite(value)) {
        return 1;
    }
    if (value < 0) {
        return 0;
    }
    if (value > 1) {
        return 1;
    }
    return value;
}

function isSoundEnabled(): boolean {
    return vscode.workspace
        .getConfiguration('ychang-sound')
        .get<boolean>('enabled', true);
}

function getNonce(): string {
    const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i += 1) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
