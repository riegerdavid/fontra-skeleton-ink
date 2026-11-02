# Skeleton Ink for Fontra

Experimental native glyph-canvas calligraphy tool for Fontra.

## What works

- **Skeleton Ink toolbar tool:** Select it in Fontra's main glyph editor toolbar, then drag on the **glyph canvas**. The drawn centerline is expanded into a closed outline and inserted into the current glyph.
- **Native outline editing:** The generated outline is a normal Fontra contour. Select it with Fontra's pointer/point tools, move nodes, edit outlines, and use Fontra undo.
- **Controls:** Open the Skeleton Ink sidebar panel to choose broad nib, pointed pen, or brush-like stroke expansion; change width, angle and contrast. Settings apply to subsequent glyph-canvas strokes.
- **Sidebar prototype:** The original separate sketch canvas and SVG export remain available.

## Install

In Fontra Plugin Manager, install this GitHub repository:

`riegerdavid/fontra-skeleton-ink`

Reload the editor if requested. Open a glyph in edit mode, select **Skeleton Ink** in the glyph-editor tool toolbar, and drag to create a contour. The right sidebar contains pen settings.

## Important limitations

This is an **experimental implementation**; it has not been runtime-tested in Fontra 2026.10.2.

- The centerline currently becomes a **baked contour** after the drag. Fontra's standard tools edit the resulting outline points, **not a persistent skeleton**.
- Changing nib settings does not recompute an existing contour.
- The implementation uses straight polygon segments, so curves may be rough.
- There is no live stroke preview during dragging yet.
- This is not a full recreation of LTTR/INK.

## License

MIT. Independent implementation, not affiliated with LTTR/INK.
