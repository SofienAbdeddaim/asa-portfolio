# 23. Two quiet surprises: a hidden terminal and a living name

Status: accepted (extends the motion budget of ADR 20; the look, tokens and reduced-motion rules of ADR 20 still apply).

## Context

The owner wanted the portfolio to feel more fun without going back to the playful "sticker book" look that ADR 20 removed. The main readers are recruiters and clients for a senior Tech Lead, many of them developers. The owner compared four options on a mockup (a hidden terminal in the palette, a name that reacts to the pointer, an animated micro frontends map, an AI chat about the CV) and chose the first two, together.

## Decisions

- **Hidden terminal in the Ctrl/Cmd+K palette.** Typing a developer command switches the palette to a small console. Listed commands (`help`, `whoami`, `cat stack.txt`, `git log --oneline`, `uptime`, `ls projects/`, `sudo hire`, `clear`, `exit`) are offered in the list as soon as two letters match; a few easter eggs answer but are never listed. The logic is a set of pure functions in `core/terminal.ts`; the palette only renders lines and runs the follow-up action.
- **Answers come from the content.** Like the hero figures, nothing is typed in: `whoami` reads the profile, `git log` turns each published experience into a commit (newest first, a stable short hash, `chore: init` for the first degree), `cat stack.txt` lists level 5 skills, `uptime` counts from the first role, `ls projects/` lists published projects. An empty source answers "nothing published yet". Command names stay in English (they are shell commands); descriptions and answers are Transloco keys in the three languages.
- **`sudo hire` leads to the contact section.** After a two-line reply the palette closes and moves to `#contact` (navigating home first from another page).
- **Accessibility.** In terminal mode the input stops being a combobox (it becomes a labelled text box) and the output is a `role="log"` polite live region; each line uses `dir="auto"` and the prompt row is left to right, so Arabic answers read correctly. Tab completes a command only when there is something to complete, otherwise focus moves as usual. Up and down walk the command history. Output appears line by line (45 ms per line), at once under reduced motion. Tested in `app.spec.ts` and by axe in `e2e/tests/a11y.spec.ts`.
- **Living name.** In the hero, each letter of a Latin name gets heavier as the pointer comes near it (weight 480 to 850 on the variable display font's weight axis, smoothstep over 170 px), and returns to rest when the pointer leaves. Only with a fine hovering pointer (`(hover: hover) and (pointer: fine)`) and full motion; touch screens and reduced motion see the normal name. Arabic words are never split, because their letters join. There is no automatic animation on load, so nothing shifts without the visitor's action and the Lighthouse layout-shift budget is untouched.
- **Console note.** In the browser, a signed, translated `console.info` invites curious visitors to open the palette and type `help`.

## Consequences

- No new colors, fonts or dependencies: tones map to existing tokens (`ok`, `accent`, `muted`, `link`).
- Adding a command means adding it to `TERMINAL_COMMANDS`, a case in `runCommand`, and its `terminal.help.*` key in the three language files.
- Hover changes letter widths a little, so the name reflows slightly while the pointer moves over it; this is accepted as part of the effect.
- The hero name words are now block-level in every motion mode (they ran together as "FirstLast" under reduced motion before).
