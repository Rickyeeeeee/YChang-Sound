import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

let disposable: vscode.Disposable | undefined;
let soundSidebarView: vscode.WebviewView | undefined;
const SLOT_SYMBOLS = ['CHERRY', 'LEMON', 'BELL', 'SEVEN', 'YCHANG'];
let slotStats = { spins: 0, wins: 0 };

class SoundSidebarViewProvider implements vscode.WebviewViewProvider {
    constructor(private readonly context: vscode.ExtensionContext) {}

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        slotStats = { spins: 0, wins: 0 };
        soundSidebarView = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtml(
            webviewView.webview,
            getConfiguredVolume(),
            slotStats
        );

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
                const reels = spinSlotReels();
                const isWin = reels[0] === reels[1] && reels[1] === reels[2];

                slotStats = {
                    spins: slotStats.spins + 1,
                    wins: slotStats.wins + (isWin ? 1 : 0),
                };

                if (isWin && isSoundEnabled()) {
                    playErrorSound(this.context, true, false);
                }

                webviewView.webview.postMessage({
                    type: 'slotSpinResult',
                    reels,
                    isWin,
                    stats: slotStats,
                });
            }
        });
    }

    private getHtml(
        webview: vscode.Webview,
        volume: number,
        stats: { spins: number; wins: number }
    ): string {
        const nonce = getNonce();
        const percent = Math.round(volume * 100);
        const escapedVolume = volume.toFixed(2);
        const initialWinRate =
            stats.spins === 0 ? '0.0' : ((stats.wins / stats.spins) * 100).toFixed(1);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>YChang Sound</title>
    <style>
        html, body {
            user-select: none;
            -webkit-user-select: none;
        }
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            padding: 10px;
        }
        .row {
            margin-bottom: 10px;
        }
        .value {
            color: var(--vscode-descriptionForeground);
            margin-left: 8px;
        }
        input[type="range"] {
            width: 100%;
            cursor: ew-resize;
            touch-action: none;
        }
        button {
            width: 100%;
            margin-top: 6px;
            border: 1px solid var(--vscode-button-border, transparent);
            padding: 6px 8px;
            cursor: pointer;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .section {
            margin-top: 14px;
            border-top: 1px solid var(--vscode-panel-border);
            padding-top: 12px;
        }
        .title {
            font-weight: 600;
            margin: 0 0 8px 0;
        }
        .slot-reels {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
            margin-bottom: 8px;
        }
        .slot-reel {
            text-align: center;
            border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
            background: var(--vscode-editorWidget-background);
            border-radius: 4px;
            padding: 8px 4px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.3px;
        }
        .slot-result {
            min-height: 20px;
            margin-bottom: 8px;
            color: var(--vscode-descriptionForeground);
        }
        .slot-stats {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            line-height: 1.5;
            margin-top: 8px;
        }
    </style>
</head>
<body>
    <div class="title">Sound Controls</div>
    <div class="row">
        <label for="volume">Volume <span class="value" id="volumeValue">${percent}%</span></label>
        <input id="volume" type="range" min="0" max="1" step="0.01" value="${escapedVolume}" />
    </div>
    <button id="playRandom" type="button">Play Random Sound</button>
    <button id="playConfigured" type="button">Play Configured Sound</button>

    <div class="section">
        <div class="title">Slot Machine</div>
        <div class="slot-reels">
            <div class="slot-reel" id="reel1">CHERRY</div>
            <div class="slot-reel" id="reel2">LEMON</div>
            <div class="slot-reel" id="reel3">BELL</div>
        </div>
        <div class="slot-result" id="slotResult">Spin to try your luck.</div>
        <button id="spinSlot" type="button">Spin</button>
        <div class="slot-stats">
            <div>Spins: <span id="statSpins">${stats.spins}</span></div>
            <div>Wins: <span id="statWins">${stats.wins}</span></div>
            <div>Win Rate: <span id="statRate">${initialWinRate}%</span></div>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const volumeEl = document.getElementById('volume');
        const volumeValueEl = document.getElementById('volumeValue');
        const playRandomEl = document.getElementById('playRandom');
        const playConfiguredEl = document.getElementById('playConfigured');
        const spinSlotEl = document.getElementById('spinSlot');
        const slotResultEl = document.getElementById('slotResult');
        const reelEls = [
            document.getElementById('reel1'),
            document.getElementById('reel2'),
            document.getElementById('reel3')
        ];
        const statSpinsEl = document.getElementById('statSpins');
        const statWinsEl = document.getElementById('statWins');
        const statRateEl = document.getElementById('statRate');

        const symbols = ${JSON.stringify(SLOT_SYMBOLS)};
        const spinDurationMs = 700;
        let spinStartedAt = 0;
        let spinTicker = null;
        let pendingResult = null;

        const updateLabel = (value) => {
            volumeValueEl.textContent = \`\${Math.round(Number(value) * 100)}%\`;
        };

        const randomReels = () =>
            Array.from({ length: 3 }, () => symbols[Math.floor(Math.random() * symbols.length)]);

        const setReels = (reels) => {
            reels.forEach((value, index) => {
                reelEls[index].textContent = value;
            });
        };

        const setStats = (stats) => {
            statSpinsEl.textContent = String(stats.spins);
            statWinsEl.textContent = String(stats.wins);
            const rate = stats.spins === 0 ? '0.0' : ((stats.wins / stats.spins) * 100).toFixed(1);
            statRateEl.textContent = \`\${rate}%\`;
        };

        const stopTicker = () => {
            if (spinTicker !== null) {
                clearInterval(spinTicker);
                spinTicker = null;
            }
        };

        const finalizeSpin = () => {
            if (!pendingResult) {
                return;
            }
            stopTicker();
            setReels(pendingResult.reels);
            setStats(pendingResult.stats);
            slotResultEl.textContent = pendingResult.isWin
                ? 'WIN! Random YChang sound played.'
                : 'No match. Try again.';
            spinSlotEl.disabled = false;
            pendingResult = null;
        };

        document.addEventListener('dragstart', (event) => {
            event.preventDefault();
        });

        document.addEventListener('selectstart', (event) => {
            if (event.target !== volumeEl) {
                event.preventDefault();
            }
        });

        volumeEl.addEventListener('pointerdown', (event) => {
            if (typeof volumeEl.setPointerCapture === 'function') {
                volumeEl.setPointerCapture(event.pointerId);
            }
        });

        volumeEl.addEventListener('input', (event) => {
            updateLabel(event.target.value);
        });

        volumeEl.addEventListener('change', (event) => {
            vscode.postMessage({ type: 'setVolume', value: event.target.value });
        });

        playRandomEl.addEventListener('click', () => {
            vscode.postMessage({ type: 'playRandom' });
        });

        playConfiguredEl.addEventListener('click', () => {
            vscode.postMessage({ type: 'playConfigured' });
        });

        spinSlotEl.addEventListener('click', () => {
            if (spinSlotEl.disabled) {
                return;
            }

            spinSlotEl.disabled = true;
            pendingResult = null;
            spinStartedAt = Date.now();
            slotResultEl.textContent = 'Spinning...';
            stopTicker();
            spinTicker = setInterval(() => {
                setReels(randomReels());
            }, 90);

            vscode.postMessage({ type: 'slotSpinRequest' });
        });

        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.type === 'volumeUpdated') {
                volumeEl.value = String(message.value);
                updateLabel(message.value);
                return;
            }

            if (message.type === 'slotSpinResult') {
                pendingResult = message;
                const elapsed = Date.now() - spinStartedAt;
                const remaining = Math.max(0, spinDurationMs - elapsed);
                setTimeout(() => {
                    finalizeSpin();
                }, remaining);
            }
        });
    </script>
</body>
</html>`;
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

    // Register a test command so users can preview the sound
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

    // Check if file exists
    // soundPath is guaranteed to exist from filtering above

    // Use platform-native audio playback (no external dependencies needed)
    const platform = process.platform;
    let command: string;

    if (platform === 'win32') {
        // PowerShell: use .NET MediaPlayer for robust MP3/WAV playback
        const escapedPath = soundPath.replace(/'/g, "''");
        command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName PresentationCore; $p = New-Object System.Windows.Media.MediaPlayer; $p.Open('${escapedPath}'); $p.Volume = ${volume.toFixed(2)}; $p.Play(); Start-Sleep -Seconds 5"`;
    } else if (platform === 'darwin') {
        // macOS: afplay is built-in
        command = `afplay -v ${volume.toFixed(2)} "${soundPath}"`;
    } else {
        // Linux: try aplay for wav, mpg123/paplay as fallbacks
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
    return vscode.workspace.getConfiguration('ychang-sound').get<boolean>('enabled', true);
}

function spinSlotReels(): string[] {
    return [
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
    ];
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
