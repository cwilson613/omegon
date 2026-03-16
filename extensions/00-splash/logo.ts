/**
 * Omegon glitch-convergence ASCII logo animation.
 *
 * Renders the Omegon sigil + wordmark as a character-by-character
 * noise-to-clean convergence animation, inspired by CRT phosphor aesthetics.
 * Each character has a randomised unlock frame weighted centre-outward;
 * before unlock it shows a CRT-noise glyph, after unlock the final character.
 */

// ---------------------------------------------------------------------------
// Alpharius palette — raw ANSI 24-bit color codes
// ---------------------------------------------------------------------------
const PRIMARY      = "\x1b[38;2;42;180;200m";   // #2ab4c8 — accent
const PRIMARY_DIM  = "\x1b[38;2;26;136;152m";   // #1a8898 — muted accent
const DIM          = "\x1b[38;2;64;88;112m";     // #405870 — dim
const BRIGHT       = "\x1b[38;2;110;202;216m";   // #6ecad8 — bright accent
const SUCCESS      = "\x1b[38;2;26;184;120m";    // #1ab878 — green
const ERROR_CLR    = "\x1b[38;2;224;72;72m";     // #e04848 — red
const RESET        = "\x1b[0m";
const BOLD         = "\x1b[1m";

// ---------------------------------------------------------------------------
// Logo art — sigil (31 rows) + spacer (2) + wordmark (7 rows)
// ---------------------------------------------------------------------------
const MARK_ROWS = 31;

const LOGO_LINES: string[] = [
  "                                                             ..                 ",
  "                 .@.                               .@@ .    .@                  ",
  "         .. ..*@@@:.                         ...+@@@*.#@@@...@@.                ",
  "      .=@@..@@@@=@@@@@@@.                  .@@@@@@@@@@@@@@@@.@@@.               ",
  " .@@@@@@@@@@@@@@@@@@@@@@..              ....@@@@@@@@@@@@@@@@@@@@@@..            ",
  " ... .@@@@@@@@@..@@@@@@@@@               %@@@@@@@@@@@@@@@@@@@@@@@@@@.           ",
  " .@@=.     ...     .@@@@@@..           .@@@@@@@@@@@@:. ..#@@@@@@@@@.@@@         ",
  "  +.                #@@@@@@            @.@@@@@@@@@          @@@@@@@@..@@.       ",
  "                    @@@@@@@.           .@@@@@@@@@%          .@@@@@@@@@@@*.      ",
  "                   =@@@@@.@.         ...@@@@@@@@@@           .@@@@@@@@@@@@..    ",
  "                 ..@@@@@@#       .@@@@@@@@@@@@@@@%:             ..:@@@.@@@@@    ",
  "                  @@@@@@.  ..%@@@@@@@@@@@@@@@@@@@@@@@@.              @@.  @@    ",
  "                 .@@@@@@..*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@..          ..@@@.     ",
  "                  @@@@@%+@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@.           .@%      ",
  "                   @@@ @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@=                   ",
  "                   .@.@@@@@@@@@@@@@@@@@@:::@@@@@@@@@@@@@@@@@@@.                 ",
  "                    .@@@@@@@@@@@@@.  .@.@@@@@@@@.=@@@@@@@@@@@@%.                ",
  "                    @@@@@@@@@@@*@@@.    .@@@@@@@@@@ #@@@@@@@@@@.   ... ...      ",
  "                    @@@@@@@@@.@@@@@@@    .@@@@@@@@@@@.@@@@@@@@@@.=@@@@@.@.      ",
  "                    @@@@@@@@.@@@@@@@.@.   ..@@@@@@@@@@.@@@@@@@@@@@@@@@@@@@.     ",
  "                   .@@@@@@@*. @@@@@@@..     ..@@.@@@@@@.@@@@@@@=@@@@..#@@@@@    ",
  "                    @@@@@@@. :@@@@@@@@         ..=. ..@.@@@@@@@%@@@=.  @@@@#.   ",
  "                .   .@@@@@@@@@@@@@@@@+.                .@@@@@@#.@@@@@  ..@@@@ . ",
  "                .+   .@@@@@@.@@@@@@.@                 .@@@@@@@. .@@@@@.   @=%@. ",
  "          ....@@@.  ...@@@@@@#@@@@..                 .@@@@@@=    ..@@@@.. .#.   ",
  "         =+.@@@@@@@@@   =@@@@@@...                 .@@@@@@@.     #.*@@@   ..    ",
  "     .@@@@@@@@@:@@@@@.:. .=@@@@@@@..           ..@@@@@@@@    ..@@@@@@@@         ",
  "     ...@@*  .. ..+.@@@@@@@@@@@@@@@@@@@.    @@@@@@@@@@@@@@@@@@@@@@@#..          ",
  "      @..           @@@@@@@@@@@@@@@@@@@.    @@@@@@@@@@@@@@@@@@@@@@              ",
  "                  @ @@@@@@@@@@@@@@@@@@@.    @@@@@@@@@@@@@@@@@@@@#               ",
  "               .@@@ @@@@@@@@@@@@@@@@@@@.    @@@@@@@@@@@@@@@@@@@@                ",
  // spacer
  "                                                                                ",
  "                                                                                ",
  // wordmark (7 rows)
  "      ...     .  .. .    ... .         . . .      .         ...        .        ",
  "      @@@@@@@@@@  @@@..  .@@@  .@@@@@@@@ .@@@@@@@@@  @@@@@@@@@. =@@@=  @@@      ",
  "      @@@    @@@  @@@@. .@@@@  .@@...... .@@         @@=    @@  =@@@@%.@@@      ",
  "      @@@    @@@  @@.@@.@@.@@  .@@@@@@@. .@@  @@@@@  @@=    @@  =@@.@@@@@@      ",
  "      @@@    @@@  @@ =@@@=.@@  .@@       .@@    .@@  @@=    @@  =@@  @@@@@      ",
  "      *@@@@@@@@:  @@ .@@%..@@  .@@@@@@@@ .@@@@@@@@@ .@@@@@@@@@  =@@  .#@@@      ",
  "       ..     .  .. .     .. . ..      .  ..   .. .   .     .   . ..            ",
];

const LINE_WIDTH = Math.max(...LOGO_LINES.map(l => l.length));
// Pad all lines to uniform width
for (let i = 0; i < LOGO_LINES.length; i++) {
  LOGO_LINES[i] = LOGO_LINES[i].padEnd(LINE_WIDTH);
}

// ---------------------------------------------------------------------------
// Noise glyphs — CRT phosphor aesthetic
// ---------------------------------------------------------------------------
const NOISE_CHARS = "▓▒░█▄▀▌▐▊▋▍▎▏◆■□▪◇┼╬╪╫┤├┬┴╱╲│─";

// ---------------------------------------------------------------------------
// Animation parameters
// ---------------------------------------------------------------------------
export const FRAME_INTERVAL_MS = 45;   // ~22 fps
export const TOTAL_FRAMES      = 38;   // ~1.7s to full resolution
export const HOLD_FRAMES       = 6;    // hold clean logo before transition

// ---------------------------------------------------------------------------
// Seeded RNG (deterministic noise per frame)
// ---------------------------------------------------------------------------
class SimpleRNG {
  private s: number;
  constructor(seed: number) { this.s = seed | 0; }
  next(): number {
    this.s = (this.s * 1664525 + 1013904223) & 0x7fffffff;
    return this.s / 0x7fffffff;
  }
  choice<T>(arr: string | T[]): T | string {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

// ---------------------------------------------------------------------------
// Unlock frame assignment
// ---------------------------------------------------------------------------
export type FrameMap = [appear: number, unlock: number][][];

export function assignUnlockFrames(lines: string[], total: number, seed = 42): FrameMap {
  const rng = new SimpleRNG(seed);
  const height = lines.length;
  const cascadeEnd = Math.floor(total * 0.55);
  const maxGlitch = Math.floor(total * 0.40);

  return lines.map((line, y) => {
    const baseAppear = Math.floor((y / Math.max(height - 1, 1)) * cascadeEnd);
    const cx = line.length / 2;
    return [...line].map((ch, x) => {
      if (ch === " ") return [0, 0] as [number, number];
      const appear = baseAppear + Math.floor(rng.next() * 3);
      const distFromCx = Math.abs(x - cx) / Math.max(cx, 1);
      const hi = Math.max(4, Math.floor(maxGlitch * (0.35 + 0.65 * (1 - distFromCx))));
      const lo = Math.max(3, Math.floor(hi * 0.25));
      const unlock = Math.min(
        appear + lo + Math.floor(rng.next() * (hi - lo + 1)),
        total - 2,
      );
      return [appear, unlock] as [number, number];
    });
  });
}

// ---------------------------------------------------------------------------
// Render a single animation frame → string[] (one per line)
// ---------------------------------------------------------------------------
export function renderFrame(
  frame: number,
  lines: string[],
  frameMap: FrameMap,
  noiseSeed: number,
  markRows: number = MARK_ROWS,
): string[] {
  const rng = new SimpleRNG(noiseSeed + frame * 997);
  const output: string[] = [];

  for (let y = 0; y < lines.length; y++) {
    const line = lines[y];
    const row = frameMap[y];
    let buf = "";
    let lastColor = "";

    for (let x = 0; x < line.length; x++) {
      const ch = line[x];
      const [appear, unlock] = row[x];

      if (ch === " ") {
        if (lastColor) { buf += RESET; lastColor = ""; }
        buf += " ";
      } else if (frame < appear) {
        // Not yet visible
        if (lastColor) { buf += RESET; lastColor = ""; }
        buf += " ";
      } else if (frame >= unlock) {
        // Resolved — final glyph
        const color = y >= markRows + 1 ? `${BOLD}${BRIGHT}` : PRIMARY;
        if (color !== lastColor) { buf += color; lastColor = color; }
        buf += ch;
      } else {
        // Glitching — CRT noise
        const noise = rng.choice(NOISE_CHARS) as string;
        const progress = (frame - appear) / Math.max(1, unlock - appear);
        let color: string;
        if (frame === appear) {
          color = BRIGHT;  // arrival flash
        } else if (progress > 0.65) {
          color = DIM;     // dimming as it converges
        } else {
          color = PRIMARY_DIM;
        }
        if (color !== lastColor) { buf += color; lastColor = color; }
        buf += noise;
      }
    }
    if (lastColor) buf += RESET;
    output.push(buf);
  }
  return output;
}

// ---------------------------------------------------------------------------
// Pre-computed data for the default logo
// ---------------------------------------------------------------------------
/** Wordmark-only lines (spacer + 7 wordmark rows) for compact terminals. */
const WORDMARK_LINES: string[] = LOGO_LINES.slice(MARK_ROWS + 1); // skip sigil + first spacer, keep second spacer + wordmark
// Pad to same width
for (let i = 0; i < WORDMARK_LINES.length; i++) {
  WORDMARK_LINES[i] = WORDMARK_LINES[i].padEnd(LINE_WIDTH);
}

// ---------------------------------------------------------------------------
// Compact logo — sigil + wordmark for mid-size terminals (~56 cols)
// ---------------------------------------------------------------------------
const COMPACT_MARK_ROWS = 23;

const COMPACT_LOGO_LINES: string[] = [
  "            *                      ```     #`          ",
  "     ` ```##`                   ``````##` .#`          ",
  "````##`#########             `############`##`         ",
  "*`*##############           `##################`       ",
  "##:````*`   `####`         `#########` *#######:##     ",
  "`            #####        ``#######       ######`#`    ",
  "            `#####         #######.        #########`  ",
  "            ####``   ``*@@@@@@@@@@`*          `## #### ",
  "           #####  `@@@@@@@@@@@@@@@@@@@          `#@ :` ",
  "           #####`@@@@@@@@@@@@@@@@@@@@@@@@`        `#`  ",
  "            ##*@@@@@@@@@@@@@@@@@@@@@@@@@@@`            ",
  "             :@@@@@@@@@@@``##```@@@@@@@@@@@``          ",
  "             @@@@@@@@*#:`  `#######`@@@@@@@@`  `   `   ",
  "             @@@@@@@#####`  `########`@@@@@@@`####`#`  ",
  "             @@@@@@ ######    `#`#####`@@@@@@########` ",
  "             @@@@@  ######      `::``#*@@@@@`##`  #### ",
  "             `@@@@@#######            `@@@@@`###` `*## ",
  "        ``#`  .@@@@`#####            `@@@@@` ``###` `**",
  "    ``:######```@@@@@#`            `.@@@@.   `#.##`    ",
  "   ######`####`* `@@@@@@        ``@@@@@`  ``#####`     ",
  "   #*       .@@@@@@@@@@@@@@   :@@@@@@@@@@@@@@##        ",
  "   `        .@@@@@@@@@@@@@@   :@@@@@@@@@@@@@@`         ",
  "         .@  `                              `          ",
  // spacer
  "                                                       ",
  // wordmark (4 rows)
  "   @@@@@@@ @@@` `@@@ @@@@@@``@@@@@@ `@@@@@@@`@@@` @@  ",
  "   @@   @@ @@@@`@@@@ @@```` `@@`    `@@   @@ @@@@ @@  ",
  "   @@   @@ @@ @*@`@@ @@@@`  `@@`@@@ `@@   @@ @@ *@@@  ",
  "   @@@@@@@ @@ `@``@@ @@@@@@``@@@@@@ `@@@@@@@`@@  `@@  ",
];

const COMPACT_LINE_WIDTH = Math.max(...COMPACT_LOGO_LINES.map(l => l.length));
for (let i = 0; i < COMPACT_LOGO_LINES.length; i++) {
  COMPACT_LOGO_LINES[i] = COMPACT_LOGO_LINES[i].padEnd(COMPACT_LINE_WIDTH);
}

export { LOGO_LINES, WORDMARK_LINES, LINE_WIDTH, MARK_ROWS };
export { COMPACT_LOGO_LINES, COMPACT_LINE_WIDTH, COMPACT_MARK_ROWS };
export { PRIMARY, PRIMARY_DIM, DIM, BRIGHT, SUCCESS, ERROR_CLR, RESET, BOLD };
