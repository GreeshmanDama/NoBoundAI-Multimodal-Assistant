
import {
  AlertCircle,
  Code2,
  Download,
  FileText,
  Folder,
  FolderOpen,
  LoaderCircle,
  RefreshCw,
  Upload,
} from "lucide-react";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

function Artifacts({ api, refreshKey = 0 }) {
  const { selectedConversation } = useSelector(
    (state) => state.conversation
  );

  const conversationId = selectedConversation?._id;

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const fileRef = useRef(null);

  // =========================================
  // LOAD FILES
  // =========================================

  const loadFiles = useCallback(async () => {
    if (!conversationId || !api) {
      setEntries([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data } = await api.get(
        "api/agent/workspace/files",
        {
          params: { conversationId },
        }
      );

      setEntries(
        Array.isArray(data.entries) ? data.entries : []
      );
    } catch (err) {
      console.error("Workspace loading error:", err);

      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Failed to load workspace files."
      );
    } finally {
      setLoading(false);
    }
  }, [api, conversationId]);

  // Refresh when conversation changes or AI creates files.
  useEffect(() => {
    const callLoadFiles = () => {
      loadFiles();
    }
    callLoadFiles()
  }, [loadFiles, refreshKey]);

  // =========================================
  // IMPORT PROJECT
  // =========================================

  const handleImport = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Please upload a ZIP project.");
      event.target.value = "";
      return;
    }

    if (!conversationId) {
      setError("Please select or create a conversation first.");
      event.target.value = "";
      return;
    }

    const formData = new FormData();

    formData.append("project", file);
    formData.append("conversationId", conversationId);

    setUploading(true);
    setError("");

    try {
      await api.post(
        "/api/agent/workspace/import",
        formData
      );

      await loadFiles();
    } catch (err) {
      console.error("Import error:", err);

      setError(
        err.response?.data?.error ||
        "Project import failed."
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  // =========================================
  // DOWNLOAD PROJECT
  // =========================================

  const handleDownload = async () => {
    if (!conversationId) return;

    setDownloading(true);
    setError("");

    try {
      const response = await api.get(
        "/api/agent/workspace/export",
        {
          params: { conversationId },
          responseType: "blob",
        }
      );

      const url = URL.createObjectURL(response.data);

      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = "nobound-project.zip";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("Download error:", err);
      setError("Failed to download project.");
    } finally {
      setDownloading(false);
    }
  };

  // =========================================
  // FILE ICON
  // =========================================

  const getIcon = (entry) => {
    if (entry.type === "directory") return Folder;

    const extension = entry.path.split(".").pop()?.toLowerCase();

    const codeFiles = [
      "js", "jsx", "ts", "tsx",
      "json", "css", "html", "py",
      "java", "cpp", "c", "go",
      "rs", "sql",
    ];

    return codeFiles.includes(extension) ? Code2 : FileText;
  };

  const formatSize = (size = 0) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  };

  const fileCount = entries.filter(
    (entry) => entry.type === "file"
  ).length;

  // =========================================
  // UI
  // =========================================

  return (
    <aside className="
      hidden
      h-full
      w-72
      shrink-0
      flex-col
      overflow-hidden
      border-l
      border-white/10
      bg-[#0d0f14]
      text-white
      lg:flex
    ">

      {/* HEADER */}

      <div className="
        flex
        items-center
        justify-between
        border-b
        border-white/10
        px-4
        py-4
      ">
        <div className="flex items-center gap-2.5">
          <div className="
            flex h-8 w-8
            items-center justify-center
            rounded-lg
            bg-white/8
          ">
            <FolderOpen size={17} />
          </div>

          <div>
            <h3 className="text-sm font-semibold">
              Project Files
            </h3>

            <p className="text-[10px] text-neutral-500">
              {fileCount} files
            </p>
          </div>
        </div>

        <button
          onClick={loadFiles}
          disabled={loading || !conversationId}
          title="Refresh files"
          className="
            rounded-lg
            p-2
            text-neutral-400
            transition
            hover:bg-white/10
            hover:text-white
            disabled:opacity-40
          "
        >
          <RefreshCw
            size={15}
            className={loading ? "animate-spin" : ""}
          />
        </button>
      </div>

      {/* ACTIONS */}

      <div className="flex gap-2 border-b border-white/10 p-3">

        <input
          ref={fileRef}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={handleImport}
        />

        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !conversationId}
          className="
            flex flex-1
            items-center justify-center
            gap-2
            rounded-lg
            bg-white
            px-2
            py-2
            text-xs
            font-semibold
            text-black
            transition
            hover:bg-neutral-200
            disabled:opacity-40
          "
        >
          {uploading ? (
            <LoaderCircle size={13} className="animate-spin" />
          ) : (
            <Upload size={13} />
          )}

          Import
        </button>

        <button
          onClick={handleDownload}
          disabled={downloading || !conversationId || fileCount === 0}
          className="
            flex flex-1
            items-center justify-center
            gap-2
            rounded-lg
            border border-white/10
            bg-white/5
            px-2
            py-2
            text-xs
            font-medium
            text-white
            transition
            hover:bg-white/10
            disabled:opacity-40
          "
        >
          {downloading ? (
            <LoaderCircle size={13} className="animate-spin" />
          ) : (
            <Download size={13} />
          )}

          Export
        </button>

      </div>

      {/* ERROR */}

      {error && (
        <div className="
          mx-3 mt-3
          flex items-start gap-2
          rounded-lg
          border border-red-500/20
          bg-red-500/10
          px-3 py-2
          text-xs text-red-300
        ">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* FILE TREE */}

      <div className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-none">

        {!conversationId ? (
          <div className="
            flex h-full
            flex-col items-center justify-center
            text-center
          ">
            <Folder size={28} className="mb-3 text-neutral-600" />

            <p className="text-xs text-neutral-400">
              Select a conversation
            </p>

            <p className="mt-1 text-[10px] text-neutral-600">
              Your project files will appear here.
            </p>
          </div>
        ) : loading && entries.length === 0 ? (
          <div className="
            flex h-full
            items-center justify-center
            gap-2
            text-xs text-neutral-500
          ">
            <LoaderCircle size={15} className="animate-spin" />
            Loading files...
          </div>
        ) : entries.length === 0 ? (
          <div className="
            flex h-full
            flex-col items-center justify-center
            px-4
            text-center
          ">
            <FolderOpen
              size={30}
              className="mb-3 text-neutral-600"
            />

            <p className="text-xs font-medium text-neutral-300">
              No files yet
            </p>

            <p className="mt-1 text-[10px] leading-5 text-neutral-500">
              Upload an existing React project or ask NoBound AI
              to create one.
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">

            {[...entries]
              .sort((a, b) => a.path.localeCompare(b.path))
              .map((entry) => {
                const Icon = getIcon(entry);

                const depth = entry.path.split("/").length - 1;

                const name = entry.path.split("/").pop();

                return (
                  <div
                    key={entry.path}
                    title={entry.path}
                    className="
                      group
                      flex
                      items-center
                      gap-2
                      rounded-lg
                      px-2
                      py-2
                      transition
                      hover:bg-white/6
                    "
                    style={{
                      paddingLeft: `${10 + depth * 13}px`,
                    }}
                  >
                    <Icon
                      size={15}
                      className={
                        entry.type === "directory"
                          ? "shrink-0 text-yellow-500"
                          : "shrink-0 text-indigo-400"
                      }
                    />

                    <span className="
                      min-w-0 flex-1 truncate
                      text-xs text-neutral-300
                      group-hover:text-white
                    ">
                      {name}
                    </span>

                    {entry.type === "file" && (
                      <span className="
                        shrink-0
                        text-[9px]
                        text-neutral-600
                      ">
                        {formatSize(entry.size)}
                      </span>
                    )}
                  </div>
                );
              })}

          </div>
        )}

      </div>

      {/* FOOTER */}

      <div className="
        border-t border-white/10
        px-3 py-2.5
        text-center
        text-[10px]
        tracking-wide
        text-neutral-600
      ">
        NoBound AI Workspace
      </div>

    </aside>
  );
}

export default Artifacts;
