import { useState, useRef, useEffect } from 'react'
import { Upload, Download, Loader2, RefreshCcw, Eraser, EyeOff } from 'lucide-react'
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redactedImage, setRedactedImage] = useState<string | null>(null);
  const [options, setOptions] = useState({
    faces: false,
    licensePlates: false,
    screens: false,
    custom: '',
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load default image for demo purpose
    const loadDefault = async () => {
      try {
        const res = await fetch('/default.webp');
        if (!res.ok) return;
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          setImage(result);
          // Draw initial state to canvas
          const img = new Image();
          img.onload = () => {
            if (canvasRef.current) {
              const canvas = canvasRef.current;
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0);
            }
          };
          img.src = result;
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.error("Failed to load default image", err);
      }
    };
    loadDefault();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage(e.target?.result as string);
        setRedactedImage(null);
        // Clear canvas
        if (canvasRef.current && e.target?.result) {
          const img = new Image();
          img.onload = () => {
            const canvas = canvasRef.current!;
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
          };
          img.src = e.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRedact = async () => {
    if (!image) return;
    setLoading(true);
    setRedactedImage(null);

    try {
      // 1. Construct prompts
      const prompts = [];
      if (options.faces) prompts.push("face");
      if (options.licensePlates) prompts.push("license plate");
      if (options.screens) prompts.push("computer screen", "monitor", "laptop");
      if (options.custom) prompts.push(options.custom);

      if (prompts.length === 0) {
        alert("Please select at least one redaction category.");
        setLoading(false);
        return;
      }

      // 2. Call API
      const base64Data = image.split(',')[1];

      const apiUrl = import.meta.env.VITE_API_URL || '/v1/ground';
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
          text: prompts.join('. '),
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

      // Handle nested output structure from modal/runpod
      const output = data.output || data;
      const masks = output.masks_b64 || output.masks || [];

      await processRedaction(masks);

    } catch (err) {
      console.error(err);
      alert("Failed to redact image. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  const processRedaction = async (masksB64: string[]) => {
    if (!canvasRef.current || !image) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = image;
    await new Promise((resolve) => { img.onload = resolve; });

    // Ensure canvas size matches image
    canvas.width = img.width;
    canvas.height = img.height;

    // 1. Draw Original Image
    ctx.drawImage(img, 0, 0);

    if (masksB64.length === 0) {
      alert("No areas found to redact.");
      return;
    }

    // 2. Process masks and draw black redactions
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    const tempCtx = tempCanvas.getContext('2d')!;

    const maskImages = await Promise.all(masksB64.map(b64 => {
      return new Promise<HTMLImageElement>((resolve) => {
        const mImg = new Image();
        mImg.onload = () => resolve(mImg);
        mImg.src = `data:image/png;base64,${b64}`;
      });
    }));

    maskImages.forEach(mImg => {
      // Clear temp canvas
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
      // Draw mask image (grayscale)
      tempCtx.drawImage(mImg, 0, 0, img.width, img.height);

      // Convert grayscale to alpha mask and make it black
      const frame = tempCtx.getImageData(0, 0, img.width, img.height);
      const data = frame.data;

      for (let i = 0; i < data.length; i += 4) {
        const maskValue = data[i]; // Red channel as intensity

        // Set color to Black (0,0,0)
        data[i] = 0;     // R
        data[i + 1] = 0; // G
        data[i + 2] = 0; // B

        // Set Alpha based on mask intensity
        // Thresholding to ensure clean edges, or use raw value for anti-aliasing
        data[i + 3] = maskValue > 100 ? 255 : 0;
      }

      tempCtx.putImageData(frame, 0, 0);

      // Draw the processed black mask onto the main canvas
      ctx.drawImage(tempCanvas, 0, 0);
    });

    // Save result URL
    setRedactedImage(canvas.toDataURL('image/png'));
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans p-8">
      <header className="max-w-4xl mx-auto mb-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
            <EyeOff className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Redact.ai</h1>
            <p className="text-neutral-400 text-sm">Privacy-first image scrubber</p>
          </div>
        </div>
        <a href="https://segmentationapi.com" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-neutral-300 transition-colors text-sm">
          Powered by Segmentation API
        </a>
      </header>

      <main className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8">

        {/* Sidebar Controls */}
        <div className="space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
            <h3 className="font-medium text-neutral-200">Redaction Targets</h3>

            <label className="flex items-center gap-3 p-3 rounded-lg bg-neutral-950/50 border border-neutral-800 cursor-pointer hover:border-neutral-700 transition-colors">
              <input
                type="checkbox"
                checked={options.faces}
                onChange={e => setOptions({ ...options, faces: e.target.checked })}
                className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-red-600 focus:ring-red-600/20"
              />
              <span>Faces</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg bg-neutral-950/50 border border-neutral-800 cursor-pointer hover:border-neutral-700 transition-colors">
              <input
                type="checkbox"
                checked={options.licensePlates}
                onChange={e => setOptions({ ...options, licensePlates: e.target.checked })}
                className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-red-600 focus:ring-red-600/20"
              />
              <span>License Plates</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg bg-neutral-950/50 border border-neutral-800 cursor-pointer hover:border-neutral-700 transition-colors">
              <input
                type="checkbox"
                checked={options.screens}
                onChange={e => setOptions({ ...options, screens: e.target.checked })}
                className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-red-600 focus:ring-red-600/20"
              />
              <span>Screens / Monitors</span>
            </label>

            <div className="pt-2 border-t border-neutral-800">
              <label className="block text-xs text-neutral-500 mb-1.5 uppercase tracking-wider font-semibold">Custom Object</label>
              <input
                type="text"
                placeholder="e.g. 'credit card', 'logo'"
                value={options.custom}
                onChange={e => setOptions({ ...options, custom: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-red-600/50 focus:ring-1 focus:ring-red-600/50 transition-all"
              />
            </div>
          </div>

          <button
            onClick={handleRedact}
            disabled={!image || loading}
            className={cn(
              "w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-all shadow-lg shadow-red-900/10",
              !image || loading
                ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-500 text-white hover:shadow-red-600/20"
            )}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Eraser className="w-5 h-5" />}
            {loading ? "Processing..." : "Redact Image"}
          </button>
        </div>

        {/* Main Canvas Area */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-2 min-h-[500px] flex items-center justify-center relative overflow-hidden">
          {!image && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="text-center cursor-pointer p-12 hover:bg-neutral-900/80 transition-colors rounded-xl border-2 border-dashed border-neutral-800 hover:border-neutral-700"
            >
              <div className="w-16 h-16 bg-neutral-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-neutral-400" />
              </div>
              <h3 className="text-lg font-medium text-neutral-300">Upload an image</h3>
              <p className="text-neutral-500 mt-1">JPG, PNG up to 10MB</p>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
          />

          {/* Canvas for Result */}
          <canvas
            ref={canvasRef}
            className={cn("max-w-full max-h-[70vh] rounded-lg shadow-2xl", !image && "hidden")}
          />

          {/* Reset Button Overlay */}
          {image && (
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                onClick={() => {
                  setImage(null);
                  setRedactedImage(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="bg-neutral-900/80 backdrop-blur text-white p-2 rounded-lg hover:bg-neutral-800 transition-colors border border-neutral-700/50"
                title="Reset"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
              {redactedImage && (
                <a
                  href={redactedImage}
                  download="redacted-image.png"
                  className="bg-red-600/90 backdrop-blur text-white p-2 rounded-lg hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
