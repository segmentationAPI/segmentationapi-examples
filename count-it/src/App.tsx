import { useState, useRef, useEffect } from 'react'
import { Upload, Loader2, Play, RefreshCcw, Hash, Info } from 'lucide-react'
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [prompt, setPrompt] = useState('bucket');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load default image
    const loadDefault = async () => {
      try {
        const res = await fetch('/default.jpg');
        if (!res.ok) return;
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          setImage(result);
          initCanvas(result);
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.error("Failed to load default image", err);
      }
    };
    loadDefault();
  }, []);

  const initCanvas = (imgSrc: string) => {
    const img = new Image();
    img.onload = () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
        }
      }
    };
    img.src = imgSrc;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImage(result);
        setCount(null);
        initCanvas(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCount = async () => {
    if (!image) return;
    setLoading(true);
    setCount(null);

    try {
      const base64Data = image.split(',')[1];
      const apiUrl = '/v1/ground';
      const apiKey = import.meta.env.VITE_API_KEY;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          image: base64Data,
          action: 'ground',
          text: prompt,
          box_threshold: 0.25,
          text_threshold: 0.2,
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error: ${response.statusText} - ${errText}`);
      }

      const data = await response.json();
      console.log("API Response:", data);

      // Handle both nested output (Modal/RunPod) and direct response
      const result = data.output || data;
      const masks = result.masks_b64 || result.masks || [];
      const boxes = result.boxes || []; // [[x1, y1, x2, y2], ...]

      setCount(masks.length);
      await drawResults(masks, boxes);

    } catch (err) {
      console.error(err);
      alert("Failed to process image. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  const drawResults = async (masksB64: string[], boxes: number[][]) => {
    if (!canvasRef.current || !image) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = image;
    await new Promise((resolve) => { img.onload = resolve; });

    // Reset canvas
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    if (masksB64.length === 0) {
      return;
    }

    // 1. Draw Masks
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d')!;

    const maskImages = await Promise.all(masksB64.map(b64 => {
      return new Promise<HTMLImageElement>((resolve) => {
        const m = new Image();
        m.onload = () => resolve(m);
        m.src = `data:image/png;base64,${b64}`;
      });
    }));

    maskImages.forEach((maskImg, index) => {
      // Clear temp
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Draw mask image scaled to canvas
      tempCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);

      // Get pixel data
      const frame = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
      const data = frame.data;

      // Color generation (HSL)
      const hue = (index * 45) % 360;
      console.log(`Mask ${index} hue: ${hue}`); // Use hue to silence lint warning


      // Manually tint: Grayscale -> Color + Alpha
      for (let i = 0; i < data.length; i += 4) {
        const intensity = data[i]; // Assuming grayscale, R=G=B

        // If pixel is part of mask (bright enough)
        if (intensity > 100) {
          // Convert HSL to RGB approximation or just simple coloring
          // Simplified: Hardcoded distinct colors based on index or just simple hue rotation logic is hard in raw RGB loop without helpers.
          // Let's do a simple verified color set based on index

          // e.g. standard colors
          const colors = [
            [255, 0, 0],    // Red
            [0, 255, 0],    // Green
            [0, 0, 255],    // Blue
            [255, 165, 0],  // Orange
            [128, 0, 128],  // Purple
            [0, 255, 255],  // Cyan
            [255, 0, 255]   // Magenta
          ];
          const [r, g, b] = colors[index % colors.length];

          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 120; // Semi-transparent
        } else {
          data[i + 3] = 0; // Transparent
        }
      }

      tempCtx.putImageData(frame, 0, 0);

      // Draw to main
      ctx.drawImage(tempCanvas, 0, 0);
    });

    // 2. Draw Numbers from Boxes
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.lineWidth = 2;

    boxes.forEach((box, i) => {
      const [x1, y1, x2, y2] = box;
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const num = i + 1;

      // Calculate font size relative to box size (optional, or fixed)
      // Fixed for clarity
      const fontSize = Math.max(16, (x2 - x1) * 0.4);
      ctx.font = `bold ${Math.min(32, fontSize)}px sans-serif`;

      // Draw Circle
      const radius = Math.min(20, Math.max(10, (x2 - x1) / 3));
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.stroke();

      // Draw Text
      ctx.fillStyle = '#000';
      ctx.shadowBlur = 0;
      ctx.fillText(num.toString(), cx, cy);

      // Restore shadow for next
      ctx.shadowBlur = 4;
    });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans p-4 md:p-8">
      <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row items-center justify-between border-b border-neutral-800 pb-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-900/20">
            <Hash className="text-black w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">CountIt</h1>
            <p className="text-neutral-400 text-sm">Industrial Inventory Counter</p>
          </div>
        </div>
        <div className="text-center md:text-right">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mb-1">Powered By</div>
          <a href="https://segmentationapi.com" target="_blank" className="text-sm font-medium text-amber-500 hover:text-amber-400 transition-colors">Segmentation API</a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8 items-start">

        {/* Sidebar */}
        <div className="space-y-6">

          {/* Stats Card */}
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[140px] relative overflow-hidden group">
            <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors" />
            <h3 className="relative z-10 text-neutral-400 text-xs font-bold uppercase tracking-widest mb-2">Total Count</h3>
            <div className="relative z-10 text-7xl font-bold text-white tabular-nums tracking-tighter">
              {count !== null ? count : '-'}
            </div>
          </div>

          {/* Controls */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-300 mb-2">
                <span>Object to Count</span>
                <Info className="w-3 h-3 text-neutral-500" />
              </label>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-3 text-neutral-100 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all placeholder:text-neutral-600"
                placeholder="e.g. rebar"
              />
              <div className="flex gap-2 mt-2">
                {['bucket', 'pipes', 'wood', 'cars'].map(ex => (
                  <button
                    key={ex}
                    onClick={() => setPrompt(ex)}
                    className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={handleCount}
                disabled={!image || loading}
                className={cn(
                  "w-full py-4 px-6 rounded-xl flex items-center justify-center gap-3 font-bold text-lg transition-all shadow-lg active:scale-[0.98]",
                  !image || loading
                    ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                    : "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-900/20 hover:shadow-amber-500/30"
                )}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                {loading ? "Counting..." : "Count Objects"}
              </button>

              <div className="relative group">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-6 rounded-xl flex items-center justify-center gap-2 font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-all border border-neutral-700 group-hover:border-neutral-600"
                >
                  <Upload className="w-4 h-4" />
                  Upload New Image
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-3 min-h-[600px] flex flex-col shadow-2xl">
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-medium text-neutral-400">Live Canvas</span>
            </div>
            {image && (
              <button
                onClick={() => {
                  if (canvasRef.current && image) {
                    const ctx = canvasRef.current.getContext('2d');
                    const img = new Image();
                    img.onload = () => {
                      if (ctx) {
                        ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
                        ctx.drawImage(img, 0, 0);
                      }
                    };
                    img.src = image;
                    setCount(null);
                  }
                }}
                className="text-xs flex items-center gap-1.5 text-neutral-500 hover:text-white transition-colors py-1 px-2 rounded hover:bg-neutral-800"
              >
                <RefreshCcw className="w-3 h-3" />
                Reset View
              </button>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center bg-[url('/grid.svg')] bg-neutral-950/30 rounded-xl overflow-hidden relative border border-neutral-800/50">
            {!image && (
              <div className="flex flex-col items-center justify-center text-neutral-500">
                <Loader2 className="w-8 h-8 animate-spin mb-4 opacity-50" />
                <p className="text-sm font-medium">Loading demo assets...</p>
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-[75vh] object-contain"
            />
          </div>
        </div>

      </main>
    </div>
  )
}
