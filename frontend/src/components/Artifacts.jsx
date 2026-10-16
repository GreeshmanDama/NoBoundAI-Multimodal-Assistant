
// function Artifacts() {
//   return (
//     <div className="hidden lg:flex h-full border-l border-white/6 flex-col overflow-hidden shrink-0 w-50">
//       Artifacts
//     </div>
//   )
// }

// export default Artifacts

import { useState } from "react";

export default function Artifacts() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const generateImage = () => {
    if (!prompt.trim()) return;

    const url = new URL(
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`
    );

    url.searchParams.set("width", "1024");
    url.searchParams.set("height", "1024");
    url.searchParams.set("private", "true");

    setImageUrl(url.toString());
    setLoading(true);
  };

  return (
    <div>
      <input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe an image..."
      />

      <button onClick={generateImage} disabled={loading}>
        Generate Image
      </button>

      {imageUrl && (
        <img
          src={imageUrl}
          alt={prompt}
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
          style={{ maxWidth: "100%", marginTop: 16 }}
        />
      )}

      {loading && <p>Generating image...</p>}
    </div>
  );
}