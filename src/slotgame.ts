export type SlotStats = {
    spins: number;
    wins: number;
};

export type SlotSpinResult = {
    reels: string[];
    isWin: boolean;
    stats: SlotStats;
};

export const SLOT_SYMBOLS = ['CHERRY', 'LEMON', 'BELL', 'SEVEN', 'YCHANG'];

export function createInitialSlotStats(): SlotStats {
    return { spins: 0, wins: 0 };
}

export function spinSlot(currentStats: SlotStats): SlotSpinResult {
    const reels = spinSlotReels();
    const isWin = reels[0] === reels[1] && reels[1] === reels[2];
    const stats: SlotStats = {
        spins: currentStats.spins + 1,
        wins: currentStats.wins + (isWin ? 1 : 0),
    };

    return { reels, isWin, stats };
}

export function buildSidebarHtml({
    nonce,
    volume,
    stats,
}: {
    nonce: string;
    volume: number;
    stats: SlotStats;
}): string {
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
        }
        .slot-reels-wrap {
            --slot-cell-height: 42px;
            position: relative;
            margin-bottom: 8px;
        }
        .slot-payline {
            position: absolute;
            left: 0;
            right: 0;
            top: var(--slot-cell-height);
            height: var(--slot-cell-height);
            border-top: 1px solid var(--vscode-focusBorder);
            border-bottom: 1px solid var(--vscode-focusBorder);
            pointer-events: none;
            z-index: 2;
        }
        .slot-reel-window {
            position: relative;
            overflow: hidden;
            height: calc(var(--slot-cell-height) * 3);
            border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
            background: var(--vscode-editorWidget-background);
            border-radius: 4px;
        }
        .slot-strip {
            transform: translateY(0);
            will-change: transform;
        }
        .slot-cell {
            height: var(--slot-cell-height);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 25px;
            line-height: 1;
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
        <div class="slot-reels-wrap">
            <div class="slot-payline"></div>
            <div class="slot-reels">
                <div class="slot-reel-window">
                    <div class="slot-strip" id="reelStrip1"></div>
                </div>
                <div class="slot-reel-window">
                    <div class="slot-strip" id="reelStrip2"></div>
                </div>
                <div class="slot-reel-window">
                    <div class="slot-strip" id="reelStrip3"></div>
                </div>
            </div>
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
        const reelStripEls = [
            document.getElementById('reelStrip1'),
            document.getElementById('reelStrip2'),
            document.getElementById('reelStrip3')
        ];
        const statSpinsEl = document.getElementById('statSpins');
        const statWinsEl = document.getElementById('statWins');
        const statRateEl = document.getElementById('statRate');

        const logicalSymbols = ${JSON.stringify(SLOT_SYMBOLS)};
        const symbolToEmoji = {
            CHERRY: '&#127826;',
            LEMON: '&#127819;',
            BELL: '&#128276;',
            SEVEN: '7&#65039;&#8419;',
            YCHANG: '&#129489;'
        };
        const normalDurations = [800, 1000, 1200];
        const easing = 'cubic-bezier(0.2, 0.9, 0.2, 1)';
        const slotCellHeight = 42;
        const stripLength = 60;
        const finalCenterIndex = 45;
        const normalSpinRows = 12;
        const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        let finalizeTimer = null;

        const updateLabel = (value) => {
            volumeValueEl.textContent = Math.round(Number(value) * 100) + '%';
        };

        const randomEmoji = () => {
            const logical = logicalSymbols[Math.floor(Math.random() * logicalSymbols.length)];
            return symbolToEmoji[logical] || logical;
        };

        const logicalToEmoji = (logical) => symbolToEmoji[logical] || logical;

        const setStats = (newStats) => {
            statSpinsEl.textContent = String(newStats.spins);
            statWinsEl.textContent = String(newStats.wins);
            const rate = newStats.spins === 0 ? '0.0' : ((newStats.wins / newStats.spins) * 100).toFixed(1);
            statRateEl.textContent = rate + '%';
        };

        const renderStrip = (stripEl, cells, offsetY) => {
            stripEl.innerHTML = cells
                .map((cell) => '<div class="slot-cell">' + cell + '</div>')
                .join('');
            stripEl.style.transition = 'none';
            stripEl.style.transform = 'translateY(' + offsetY + 'px)';
        };

        const buildStripModel = (centerEmoji, spinRows) => {
            const cells = Array.from({ length: stripLength }, () => randomEmoji());
            cells[finalCenterIndex - 1] = randomEmoji();
            cells[finalCenterIndex] = centerEmoji;
            cells[finalCenterIndex + 1] = randomEmoji();

            const finalY = -((finalCenterIndex - 1) * slotCellHeight);
            const startY = finalY - spinRows * slotCellHeight;

            return { cells, startY, finalY };
        };

        const clearFinalizeTimer = () => {
            if (finalizeTimer !== null) {
                clearTimeout(finalizeTimer);
                finalizeTimer = null;
            }
        };

        const initializeReels = () => {
            const defaults = ['CHERRY', 'LEMON', 'BELL'];
            reelStripEls.forEach((stripEl, index) => {
                const centerEmoji = logicalToEmoji(defaults[index] || logicalSymbols[0]);
                const model = buildStripModel(centerEmoji, 0);
                renderStrip(stripEl, model.cells, model.finalY);
            });
        };

        const startSpinAnimation = (spinResult) => {
            clearFinalizeTimer();

            const reducedMotion = reducedMotionQuery.matches;
            const durations = reducedMotion ? [80, 100, 120] : normalDurations;
            const spinRows = reducedMotion ? 1 : normalSpinRows;

            reelStripEls.forEach((stripEl, index) => {
                const finalEmoji = logicalToEmoji(spinResult.reels[index]);
                const model = buildStripModel(finalEmoji, spinRows);
                renderStrip(stripEl, model.cells, model.startY);

                void stripEl.offsetHeight;

                stripEl.style.transition =
                    'transform ' + durations[index] + 'ms ' + easing;
                stripEl.style.transform = 'translateY(' + model.finalY + 'px)';
            });

            const settleDelay = Math.max.apply(null, durations) + 20;
            finalizeTimer = setTimeout(() => {
                setStats(spinResult.stats);
                slotResultEl.textContent = spinResult.isWin
                    ? 'WIN! Triple match.'
                    : 'No match. Try again.';
                spinSlotEl.disabled = false;
                finalizeTimer = null;
            }, settleDelay);
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
            slotResultEl.textContent = 'Spinning...';
            clearFinalizeTimer();

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
                startSpinAnimation(message);
            }
        });

        initializeReels();
    </script>
</body>
</html>`;
}

function spinSlotReels(): string[] {
    return [
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
    ];
}
