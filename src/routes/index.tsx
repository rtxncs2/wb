import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Pencil,
  Eraser,
  ImagePlus,
  Download,
  Trash2,
  Undo2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Whiteboard,
  head: () => ({
    meta: [
      { title: "Whiteboard — Draw & Save" },
      {
        name: "description",
        content:
          "A fullscreen whiteboard: draw with adjustable pen size and color, open images to annotate, and save as PNG to your Downloads folder.",
      },
      { property: "og:title", content: "Whiteboard — Draw & Save" },
      {
        property: "og:description",
        content:
          "Fullscreen whiteboard with pen size and color controls, image import, and PNG export.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const COLORS = [
  "#111111",
  "#e11d48",
  "#f97316",
  "#eab308",
  "#16a34a",
  "#2563eb",
  "#7c3aed",
  "#ffffff",
];

function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);

  const [color, setColor] = useState("#111111");
  const [size, setSize] = useState(6);
  const [eraser, setEraser] = useState(false);

  // Size canvas to fill the screen, preserving existing content on resize.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      const prev =
        canvas.width > 0 && canvas.height > 0
          ? ctx.getImageData(0, 0, canvas.width, canvas.height)
          : null;
      const hadContent = prev !== null;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (hadContent && prev) {
        const tmp = document.createElement("canvas");
        tmp.width = prev.width;
        tmp.height = prev.height;
        tmp.getContext("2d")!.putImageData(prev, 0, 0);
        ctx.drawImage(tmp, 0, 0);
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const snapshot = useCallback(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    undoStackRef.current.push(
      ctx.getImageData(0, 0, canvas.width, canvas.height)
    );
    if (undoStackRef.current.length > 30) undoStackRef.current.shift();
  }, []);

  const getPos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.PointerEvent) => {
    e.preventDefault();
    snapshot();
    drawingRef.current = true;
    lastRef.current = getPos(e);
    canvasRef.current!.setPointerCapture(e.pointerId);
    // Draw a dot for single taps
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.fillStyle = eraser ? "#ffffff" : color;
    ctx.beginPath();
    ctx.arc(lastRef.current.x, lastRef.current.y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const moveDraw = (e: React.PointerEvent) => {
    if (!drawingRef.current || !lastRef.current) return;
    const pos = getPos(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = eraser ? "#ffffff" : color;
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastRef.current = pos;
  };

  const endDraw = () => {
    drawingRef.current = false;
    lastRef.current = null;
  };

  const undo = () => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.putImageData(prev, 0, 0);
  };

  const clear = () => {
    snapshot();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const openImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      snapshot();
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      // Fit image into canvas, centered
      const scale = Math.min(
        canvas.width / img.width,
        canvas.height / img.height
      );
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (canvas.width - w) / 2;
      const y = (canvas.height - h) / 2;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, x, y, w, h);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
    e.target.value = "";
  };

  const savePng = () => {
    const canvas = canvasRef.current!;
    const a = document.createElement("a");
    a.download = `whiteboard-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-white select-none">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2">
        <div className="flex items-center gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              aria-label={`Color ${c}`}
              onClick={() => {
                setColor(c);
                setEraser(false);
              }}
              className={`h-7 w-7 rounded-full border border-neutral-300 transition-transform ${
                color === c && !eraser
                  ? "scale-110 ring-2 ring-neutral-800 ring-offset-1"
                  : ""
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => {
              setColor(e.target.value);
              setEraser(false);
            }}
            className="h-7 w-7 cursor-pointer rounded-full border border-neutral-300"
            aria-label="Custom color"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={40}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-28 accent-neutral-800"
            aria-label="Pen size"
          />
          <span className="w-6 text-xs text-neutral-500">{size}</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setEraser(false)}
            className={`rounded-md p-2 ${
              !eraser ? "bg-neutral-800 text-white" : "text-neutral-600 hover:bg-neutral-200"
            }`}
            aria-label="Pen"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => setEraser(true)}
            className={`rounded-md p-2 ${
              eraser ? "bg-neutral-800 text-white" : "text-neutral-600 hover:bg-neutral-200"
            }`}
            aria-label="Eraser"
          >
            <Eraser className="h-4 w-4" />
          </button>
          <button
            onClick={undo}
            className="rounded-md p-2 text-neutral-600 hover:bg-neutral-200"
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={clear}
            className="rounded-md p-2 text-neutral-600 hover:bg-neutral-200"
            aria-label="Clear"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md p-2 text-neutral-600 hover:bg-neutral-200"
            aria-label="Open image"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
          <button
            onClick={savePng}
            className="flex items-center gap-1.5 rounded-md bg-neutral-800 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            <Download className="h-4 w-4" />
            Save PNG
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 touch-none"
          onPointerDown={startDraw}
          onPointerMove={moveDraw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={openImage}
      />
    </div>
  );
}
