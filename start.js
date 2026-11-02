// Skeleton Ink: dependency-free Fontra plugin entry point.
// Uses Fontra's editor instance directly, avoiding unavailable /editor and /core imports.

const settings = { style: "broad", width: 70, angle: 35, contrast: 0.7 };

function outlineFor(points) {
  if (points.length < 2) return [];
  const a = settings.angle * Math.PI / 180;
  const nib = { x: Math.cos(a), y: Math.sin(a) };
  const left = [], right = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    let dx = next.x - prev.x, dy = next.y - prev.y;
    const length = Math.hypot(dx, dy) || 1;
    dx /= length; dy /= length;
    const nx = -dy, ny = dx;
    const projection = Math.abs(nx * nib.x + ny * nib.y);
    let width = settings.width;
    if (settings.style === "broad") width *= 0.22 + 0.78 * projection;
    if (settings.style === "pointed") width *= 0.08 + 0.92 * Math.pow(projection, 1.4);
    if (settings.style === "brush") width *= (0.35 + 0.65 * projection) *
      (0.7 + 0.3 * Math.sin(i / Math.max(1, points.length - 1) * Math.PI));
    width *= 1 + settings.contrast * (projection - 0.5);
    const half = Math.max(0.5, width / 2);
    left.push({ x: Math.round(p.x + nx * half), y: Math.round(p.y + ny * half) });
    right.push({ x: Math.round(p.x - nx * half), y: Math.round(p.y - ny * half) });
  }
  return left.concat(right.reverse());
}

// Fontra's native tool interface. Written without importing internal bundled modules.
class SkeletonInkTool {
  identifier = "skeleton-ink-tool";
  isActive = false;
  constructor(editor, iconPath) {
    this.editor = editor;
    this.iconPath = iconPath;
    this.canvasController = editor.canvasController;
    this.sceneController = editor.sceneController;
    this.sceneModel = this.sceneController.sceneModel;
  }
  setCursor() {
    this.canvasController.canvas.style.cursor =
      this.sceneModel.selectedGlyph?.isEditing ? "crosshair" : "default";
  }
  activate() { this.isActive = true; this.setCursor(); }
  deactivate() { this.isActive = false; }
  handleHover(event) { this.setCursor(); }
  handleKeyDown(event) {}

  async handleDrag(eventStream, initialEvent) {
    if (!this.sceneModel.selectedGlyph?.isEditing) return;
    const start = this.sceneController.selectedGlyphPoint(initialEvent);
    if (!Number.isFinite(start?.x) || !Number.isFinite(start?.y)) return;
    const points = [start];
    for await (const event of eventStream) {
      const p = this.sceneController.selectedGlyphPoint(event);
      if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) continue;
      const last = points[points.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= 3) points.push(p);
    }
    if (points.length < 2) return;
    const outline = outlineFor(points);
    if (outline.length < 4) return;

    // Editing the glyph path through Fontra's edit transaction, ensuring native undo.
    await this.sceneController.editGlyphAndRecordChanges((glyph) => {
      const layers = this.sceneController.getEditingLayerFromGlyphLayers(glyph.layers);
      const first = Object.values(layers)[0];
      if (!first) return;
      const firstIndex = first.path.numPoints;
      this.sceneController.selection = new Set(outline.map((_, i) => "point/" + (firstIndex + i)));
      for (const layer of Object.values(layers)) {
        // Native VarPackedPath supports appendUnpackedContour, so we do not need to import it.
        layer.path.appendUnpackedContour({ points: outline, isClosed: true });
      }
      return "Draw Skeleton Ink stroke";
    }, undefined, true);
    this.canvasController.requestUpdate();
  }
}

class SkeletonInkPanel extends HTMLElement {
  identifier = "skeleton-ink-panel";
  iconPath = "";
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const sheet = document.createElement("style");
    sheet.textContent = `
      :host{display:block;height:100%;box-sizing:border-box;color:inherit;font:inherit}
      .panel{padding:14px;display:grid;gap:14px}
      h2{font-size:1.05em;margin:0}
      label{display:grid;gap:5px;font-size:.9em}
      input,select{width:100%;box-sizing:border-box}
      .help{font-size:.85em;line-height:1.5;opacity:.8}
    `;
    root.appendChild(sheet);
    const wrapper = document.createElement("div");
    wrapper.className = "panel";
    const heading = document.createElement("h2");
    heading.textContent = "Skeleton Ink";
    wrapper.appendChild(heading);

    const fields = [
      { key: "style", title: "Tool", type: "select",
        items: [["broad","Broad nib"],["pointed","Pointed pen"],["brush","Brush"]] },
      { key: "width", title: "Width", min: 2, max: 240, step: 1 },
      { key: "angle", title: "Nib angle", min: 0, max: 180, step: 1 },
      { key: "contrast", title: "Contrast", min: 0, max: 1.5, step: .05 }
    ];
    for (const field of fields) {
      const label = document.createElement("label");
      const title = document.createElement("span");
      title.textContent = field.title + ": " + settings[field.key];
      label.appendChild(title);
      const control = document.createElement(field.type === "select" ? "select" : "input");
      if (field.type === "select") {
        for (const [value, name] of field.items) {
          const option = document.createElement("option");
          option.value = value; option.textContent = name;
          control.appendChild(option);
        }
      } else {
        control.type = "range";
        control.min = field.min; control.max = field.max; control.step = field.step;
      }
      control.value = settings[field.key];
      control.addEventListener("input", () => {
        settings[field.key] = field.type === "select" ? control.value : +control.value;
        title.textContent = field.title + ": " + settings[field.key];
      });
      label.appendChild(control);
      wrapper.appendChild(label);
    }
    const help = document.createElement("div");
    help.className = "help";
    help.textContent = "Select Skeleton Ink in Fontra's top tool toolbar and drag in an editable glyph. The generated closed outline uses Fontra's normal point tools and undo. Skeleton nodes are not persistent yet.";
    wrapper.appendChild(help);
    root.appendChild(wrapper);
  }
}

export function start(editorController, pluginPath) {
  console.info("[Skeleton Ink] Starting plugin", pluginPath);
  if (!customElements.get("skeleton-ink-panel")) {
    customElements.define("skeleton-ink-panel", SkeletonInkPanel);
  }
  const panel = new SkeletonInkPanel();
  panel.iconPath = pluginPath + "/icon.svg";
  editorController.addSidebarPanel(panel, "right");
  editorController.addEditTool(new SkeletonInkTool(editorController, pluginPath + "/icon.svg"));
  console.info("[Skeleton Ink] Toolbar tool and sidebar registered");
}
