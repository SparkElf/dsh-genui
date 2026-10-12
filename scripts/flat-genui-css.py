"""Rewrite the installed genui client bundle to the flat surface style.

The 0.11.x client inlines its CSS into lib/client.js, so the flat tokens from
src/client/GenuiBlock.module.css are applied here to the shipped artifact. Each replacement is
asserted, so a bundle that does not carry the expected rule fails loudly instead of silently
keeping the raised look.
"""

import pathlib
import sys

# The two shadow declarations, in their dark and light forms, and the border weight.
REPLACEMENTS = [
    ("--dsl-g-shadow-card:0 1px 2px #0000003d, 0 8px 24px #0000002e", "--dsl-g-shadow-card:none"),
    ("--dsl-g-shadow-card:0 1px 3px #0000001a, 0 8px 24px #0000000f", "--dsl-g-shadow-card:none"),
    (
        "--dsl-g-border-surface:color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent)",
        "--dsl-g-border-surface:color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent)",
    ),
    # The table drew its own outlined, rounded box on top of the per-cell hairlines.
    (
        ".V1MMBW_tableWrap{border-radius:var(--dsl-g-radius-control);border:1px solid var(--dsl-g-border-surface);",
        ".V1MMBW_tableWrap{",
    ),
    # Headers were shouted in uppercase with wide tracking.
    ("letter-spacing:.06em;text-transform:uppercase", ""),
]


def main(argv):
    if len(argv) != 2:
        raise SystemExit("usage: flat-genui-css.py <client.js>")
    path = pathlib.Path(argv[1])
    text = path.read_text(encoding="utf8")
    for old, new in REPLACEMENTS:
        if old not in text:
            raise SystemExit("expected rule not found in " + str(path) + ": " + old[:70])
        text = text.replace(old, new)
    path.write_text(text, encoding="utf8")
    print("  flattened " + str(len(REPLACEMENTS)) + " rules in " + str(path))


if __name__ == "__main__":
    main(sys.argv)
