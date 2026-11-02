# Skeleton Ink for Fontra

Experimental, independent skeleton-based calligraphic drawing **prototype** for Fontra.

## Features
- Draw centerline strokes in a sidebar canvas
- Broad nib, pointed pen, and brush-like outline previews
- Width, nib angle, and contrast controls
- Undo last stroke / clear all
- Export outlines as SVG

**Limitations:** The exported outline is an approximation of stroke expansion. This version does **not** insert contours into the active Fontra glyph, and has not been runtime-tested on Fontra 2026.10.2. It is not a feature-complete recreation of LTTR/INK.

## Installation
In Fontra's Plugin Manager, add the GitHub repository:
`riegerdavid/fontra-skeleton-ink`

Enable the plugin and reload Fontra if prompted. Open the Skeleton Ink sidebar panel.

## Development
The root `plugin.json` identifies `start.js` as the plugin entry point. The sidebar setup follows the structure of Fontra's reference-font plugin.

## License
MIT. Independent implementation; not affiliated with LTTR/INK.
