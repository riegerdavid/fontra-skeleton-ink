import Panel from "fontra/editor/panel.js";
import { div, button, label, input, select, option } from "fontra/core/html-utils.js";

const NS = "http://www.w3.org/2000/svg";
const fmt = (n) => Number(n.toFixed(2));

function pointsToOutline(points, width, angleDeg, contrast, style) {
  if (points.length < 2) return [];
  const angle = angleDeg * Math.PI / 180;
  const nibX = Math.cos(angle), nibY = Math.sin(angle);
  const left = [], right = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    let dx = next.x - prev.x, dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const nx = -dy, ny = dx;
    const projection = Math.abs(nx * nibX + ny * nibY);
    let localWidth = width;
    if (style === "broad") localWidth = width * (0.22 + 0.78 * projection);
    else if (style === "pointed") localWidth = width * (0.08 + 0.92 * Math.pow(projection, 1.4));
    else if (style === "brush") {
      localWidth = width * (0.35 + 0.65 * projection) *
        (0.7 + 0.3 * Math.sin(i / Math.max(1, points.length - 1) * Math.PI));
    }
    localWidth *= 1 + contrast * (projection - 0.5);
    const half = Math.max(0.5, localWidth / 2);
    left.push({ x: p.x + nx * half, y: p.y + ny * half });
    right.push({ x: p.x - nx * half, y: p.y - ny * half });
  }
  return [...left, ...right.reverse()];
}

function pathData(points) {
  if (!points.length) return "";
  return `M ${fmt(points[0].x)} ${fmt(points[0].y)} ` +
    points.slice(1).map(p => `L ${fmt(p.x)} ${fmt(p.y)}`).join(" ") + " Z";
}

class SkeletonInkPanel extends Panel {
  identifier = "skeleton-ink-panel";
  iconPath = "";

  static styles = `
    .skeleton-ink { display:flex; flex-direction:column; gap:10px; padding:10px; box-sizing:border-box; height:100%; overflow:auto; }
    .si-title { font-weight:700; font-size:1.05em; }
    .si-controls { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .si-controls label { display:flex; flex-direction:column; gap:4px; font-size:.9em; }
    .si-controls input, .si-controls select { width:100%; min-width:0; box-sizing:border-box; }
    .si-actions { display:flex; flex-wrap:wrap; gap:6px; }
    .si-canvas-wrap { min-height:220px; height:42vh; border:1px solid var(--panel-border-color,#888); border-radius:6px; overflow:hidden; background:var(--canvas-background-color,#f8f8f8); }
    .si-canvas { width:100%; height:100%; touch-action:none; display:block; }
    .si-note { font-size:.82em; opacity:.75; line-height:1.35; }
  `;

  constructor(editorController) {
    super(editorController);
    this.strokes = [];
    this.active = null;
    this.settings = { style:"broad", width:80, angle:35, contrast:0.7 };
  }

  getContentElement() {
    const styleSelect = select({ onchange:e=>{ this.settings.style=e.target.value; this.render(); } }, [
      option({ value:"broad", selected:true }, ["Broad nib"]),
      option({ value:"pointed" }, ["Pointed pen"]),
      option({ value:"brush" }, ["Brush"])
    ]);
    this.widthInput = input({ type:"range", min:2, max:240, value:this.settings.width,
      oninput:e=>{ this.settings.width=+e.target.value; this.widthValue.textContent=e.target.value; this.render(); } });
    this.angleInput = input({ type:"range", min:0, max:180, value:this.settings.angle,
      oninput:e=>{ this.settings.angle=+e.target.value; this.angleValue.textContent=e.target.value+"°"; this.render(); } });
    this.contrastInput = input({ type:"range", min:0, max:1.5, step:.05, value:this.settings.contrast,
      oninput:e=>{ this.settings.contrast=+e.target.value; this.contrastValue.textContent=(+e.target.value).toFixed(2); this.render(); } });
    this.widthValue = div({}, [String(this.settings.width)]);
    this.angleValue = div({}, [this.settings.angle+"°"]);
    this.contrastValue = div({}, [this.settings.contrast.toFixed(2)]);
    this.canvas = document.createElement("canvas");
    this.canvas.className = "si-canvas";
    this.canvasWrap = div({ class:"si-canvas-wrap" }, [this.canvas]);
    this.canvas.addEventListener("pointerdown", e=>this.pointerDown(e));
    this.canvas.addEventListener("pointermove", e=>this.pointerMove(e));
    this.canvas.addEventListener("pointerup", ()=>this.pointerUp());
    this.canvas.addEventListener("pointercancel", ()=>this.pointerUp());
    const controls = div({ class:"si-controls" }, [
      label({}, ["Tool", styleSelect]),
      label({}, ["Width", this.widthInput, this.widthValue]),
      label({}, ["Nib angle", this.angleInput, this.angleValue]),
      label({}, ["Contrast", this.contrastInput, this.contrastValue])
    ]);
    const actions = div({ class:"si-actions" }, [
      button({ type:"button", onclick:()=>{ this.strokes.pop(); this.render(); } }, ["Undo"]),
      button({ type:"button", onclick:()=>{ this.strokes=[]; this.render(); } }, ["Clear"]),
      button({ type:"button", onclick:()=>this.exportSVG() }, ["Export SVG"])
    ]);
    this.status = div({ class:"si-note" }, ["Draw a centerline on the canvas, then export the generated outline as SVG."]);
    const root = div({ class:"skeleton-ink" }, [
      div({ class:"si-title" }, ["Skeleton Ink"]),
      controls, this.canvasWrap, actions, this.status
    ]);
    requestAnimationFrame(()=>this.resizeCanvas());
    return root;
  }

  resizeCanvas() {
    const rect = this.canvasWrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(rect.width*dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height*dpr));
    this.ctx = this.canvas.getContext("2d");
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
    this.render();
  }

  localPoint(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x:e.clientX-r.left, y:e.clientY-r.top };
  }
  pointerDown(e) {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.active = { points:[this.localPoint(e)], settings:{ ...this.settings } };
    this.strokes.push(this.active);
    this.render();
  }
  pointerMove(e) {
    if (!this.active) return;
    const p = this.localPoint(e), last = this.active.points.at(-1);
    if (Math.hypot(p.x-last.x,p.y-last.y)>1.5) this.active.points.push(p);
    this.render();
  }
  pointerUp() {
    if (!this.active) return;
    if (this.active.points.length===1) {
      this.active.points.push({ ...this.active.points[0], x:this.active.points[0].x+1 });
    }
    this.active=null;
    this.render();
  }
  render() {
    if (!this.ctx) return;
    const ctx=this.ctx, w=this.canvas.clientWidth, h=this.canvas.clientHeight;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle="#f8f8f8";
    ctx.fillRect(0,0,w,h);
    ctx.save();
    ctx.strokeStyle="#999"; ctx.lineWidth=1; ctx.globalAlpha=.22;
    for (let x=0;x<w;x+=20) { ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke(); }
    for (let y=0;y<h;y+=20) { ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke(); }
    ctx.restore();
    for (const stroke of this.strokes) {
      const s=stroke.settings;
      const outline=pointsToOutline(stroke.points,s.width,s.angle,s.contrast,s.style);
      if (outline.length) {
        ctx.beginPath();ctx.moveTo(outline[0].x,outline[0].y);
        outline.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
        ctx.closePath();ctx.fillStyle="#171717";ctx.fill();
      }
      ctx.beginPath();ctx.moveTo(stroke.points[0].x,stroke.points[0].y);
      stroke.points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
      ctx.strokeStyle="#d14b35";ctx.lineWidth=1;
      ctx.setLineDash([4,4]);ctx.stroke();ctx.setLineDash([]);
    }
  }
  exportSVG() {
    const w=this.canvas.clientWidth,h=this.canvas.clientHeight;
    const paths=this.strokes.map(stroke=>{
      const s=stroke.settings;
      return pathData(pointsToOutline(stroke.points,s.width,s.angle,s.contrast,s.style));
    }).filter(Boolean);
    const svg=`<svg xmlns="${NS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${paths.map(d=>`<path d="${d}" fill="#000"/>`).join("")}</svg>`;
    const url=URL.createObjectURL(new Blob([svg],{ type:"image/svg+xml" }));
    const a=document.createElement("a");
    a.href=url;a.download="skeleton-ink.svg";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    this.status.textContent="SVG exported. Direct insertion into the active glyph is not implemented.";
  }
}

export function start(editorController, pluginPath) {
  SkeletonInkPanel.prototype.iconPath = `${pluginPath}/icon.svg`;
  customElements.define("skeleton-ink-panel", SkeletonInkPanel);
  editorController.addSidebarPanel(new SkeletonInkPanel(editorController), "right");
}
