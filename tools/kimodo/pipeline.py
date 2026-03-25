#!/usr/bin/env python3
"""
Full Kimodo Pipeline: Generate → Convert → Deploy

Generates all MEMO-9 animations via Kimodo, converts to game-ready format,
and copies to the public assets directory.

Usage:
    python pipeline.py                    # Generate all, convert to pivot JSON
    python pipeline.py --skeletal         # Generate all, convert to GLB clips
    python pipeline.py --skip-generate    # Only convert existing NPZ files
    python pipeline.py --preset crawl     # Generate + convert a single preset
"""

import argparse
import os
import shutil
import sys
from pathlib import Path

from generate import PRESETS, generate_preset

SCRIPT_DIR = Path(__file__).parent
OUTPUT_DIR = SCRIPT_DIR / "output"
PROJECT_ROOT = SCRIPT_DIR.parent.parent  # apex/

# Where converted animations go in the game
PIVOT_DEST = PROJECT_ROOT / "public" / "animations" / "kimodo"
SKELETAL_DEST = PROJECT_ROOT / "public" / "models" / "memo9" / "animations"


def run_pipeline(
    mode: str = "pivot",
    skip_generate: bool = False,
    preset_name: str = None,
):
    """Run the full pipeline."""
    from convert import convert_to_pivot_json, convert_to_skeletal_glb

    dest = SKELETAL_DEST if mode == "skeletal" else PIVOT_DEST
    ext = ".glb" if mode == "skeletal" else ".json"

    # Step 1: Generate motions
    if not skip_generate:
        presets = PRESETS
        if preset_name:
            if preset_name not in PRESETS:
                print(f"Unknown preset: {preset_name}")
                print(f"Available: {', '.join(PRESETS.keys())}")
                sys.exit(1)
            presets = {preset_name: PRESETS[preset_name]}

        print(f"=== Step 1: Generating {len(presets)} animations via Kimodo ===\n")
        for name, preset in presets.items():
            try:
                generate_preset(name, preset, str(OUTPUT_DIR))
            except Exception as e:
                print(f"  FAILED {name}: {e}")
                print("  Continuing with remaining presets...\n")

    # Step 2: Convert
    npz_files = sorted(OUTPUT_DIR.glob("*.npz"))
    if preset_name:
        npz_files = [f for f in npz_files if f.stem == preset_name]

    if not npz_files:
        print("No NPZ files to convert!")
        sys.exit(1)

    print(f"\n=== Step 2: Converting {len(npz_files)} animations to {mode} format ===\n")
    os.makedirs(dest, exist_ok=True)

    converted = []
    for npz_path in npz_files:
        name = npz_path.stem
        out_path = dest / f"{name}{ext}"
        try:
            if mode == "skeletal":
                convert_to_skeletal_glb(str(npz_path), str(out_path), anim_name=name)
            else:
                convert_to_pivot_json(str(npz_path), str(out_path))
            converted.append(name)
        except Exception as e:
            print(f"  FAILED {name}: {e}")

    # Step 3: Generate manifest
    if converted:
        manifest = {
            "version": 1,
            "mode": mode,
            "animations": {},
        }
        for name in converted:
            meta_path = OUTPUT_DIR / f"{name}_meta.json"
            meta = {}
            if meta_path.exists():
                import json
                with open(meta_path) as f:
                    meta = json.load(f)

            manifest["animations"][name] = {
                "file": f"{name}{ext}",
                "loop": meta.get("loop", False),
                "duration": meta.get("duration", 3),
                "prompt": meta.get("prompt", ""),
            }

        manifest_path = dest / "manifest.json"
        import json
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)
        print(f"\n  Manifest: {manifest_path}")

    print(f"\n=== Done! {len(converted)}/{len(npz_files)} animations converted ===")
    print(f"Output: {dest}")

    if mode == "pivot":
        print(f"\nTo use in game, animations are at: /animations/kimodo/")
        print("Load with: fetch('/animations/kimodo/manifest.json')")
    else:
        print(f"\nTo use in game, load GLBs from: /models/memo9/animations/")


def main():
    parser = argparse.ArgumentParser(description="Full Kimodo animation pipeline")
    parser.add_argument("--skeletal", action="store_true",
                        help="Output as GLB skeleton clips (default: pivot JSON)")
    parser.add_argument("--skip-generate", action="store_true",
                        help="Skip generation, only convert existing NPZ files")
    parser.add_argument("--preset", type=str,
                        help="Process a single preset only")
    args = parser.parse_args()

    mode = "skeletal" if args.skeletal else "pivot"
    run_pipeline(mode=mode, skip_generate=args.skip_generate, preset_name=args.preset)


if __name__ == "__main__":
    main()
