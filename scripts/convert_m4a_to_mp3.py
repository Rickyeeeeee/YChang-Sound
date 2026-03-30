import argparse
import shutil
import subprocess
from pathlib import Path


def find_ffmpeg(explicit_path: str | None) -> str:
    if explicit_path:
        return explicit_path
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise FileNotFoundError(
            "ffmpeg not found in PATH. Install ffmpeg or pass --ffmpeg-path."
        )
    return ffmpeg


def convert_file(ffmpeg: str, src: Path, dst: Path, overwrite: bool) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ffmpeg,
        "-y" if overwrite else "-n",
        "-i",
        str(src),
        "-codec:a",
        "libmp3lame",
        "-q:a",
        "2",
        str(dst),
    ]
    subprocess.run(cmd, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert all .m4a files under sounds/ into .mp3."
    )
    parser.add_argument(
        "--sounds-dir",
        default="sounds",
        help="Path to the sounds directory (default: sounds).",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing .mp3 files.",
    )
    parser.add_argument(
        "--ffmpeg-path",
        default=None,
        help="Explicit path to ffmpeg if not on PATH.",
    )
    args = parser.parse_args()

    sounds_dir = Path(args.sounds_dir)
    if not sounds_dir.exists():
        raise FileNotFoundError(f"Sounds directory not found: {sounds_dir}")

    ffmpeg = find_ffmpeg(args.ffmpeg_path)

    m4a_files = sorted(sounds_dir.rglob("*.m4a"))
    if not m4a_files:
        print(f"No .m4a files found under {sounds_dir}")
        return 0

    converted = 0
    skipped = 0
    for src in m4a_files:
        dst = src.with_suffix(".mp3")
        if dst.exists() and not args.overwrite:
            skipped += 1
            continue
        convert_file(ffmpeg, src, dst, args.overwrite)
        converted += 1

    print(f"Converted: {converted}, Skipped: {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
