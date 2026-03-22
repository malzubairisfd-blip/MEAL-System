// src/app/devtool/page.tsx

"use client"

import { useEffect, useState } from "react"

function TreeNode({ node, onSelect }: any) {
  const [open, setOpen] = useState(false)

  if (node.type === "folder") {
    return (
      <div>
        <div onClick={() => setOpen(!open)} style={{ cursor: "pointer" }}>
          📁 {node.name}
        </div>
        {open && (
          <div style={{ paddingLeft: 15 }}>
            {node.children?.map((c: any) => (
              <TreeNode key={c.path} node={c} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={() => onSelect(node.path)}
      style={{ cursor: "pointer", paddingLeft: 10 }}
    >
      📄 {node.name}
    </div>
  )
}

export default function DevToolPage() {
  const [tree, setTree] = useState<any[]>([])
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [preview, setPreview] = useState("")

  useEffect(() => {
    fetch("/api/devtool")
      .then(r => r.json())
      .then(setTree)
  }, [])

  const selectFile = async (path: string) => {
    setSelectedFiles(prev =>
      prev.includes(path) ? prev : [...prev, path]
    )

    const res = await fetch(path.replace(process.cwd(), ""))
    const text = await res.text().catch(() => "")

    setPreview(text)
  }

  const exportTXT = async () => {
    const res = await fetch("/api/devtool", {
      method: "POST",
      body: JSON.stringify({ files: selectedFiles }),
    })

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = "devtool.txt"
    a.click()
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>

      {/* Tree */}
      <div style={{ width: "25%", borderRight: "1px solid #ccc", overflow: "auto", padding: 10 }}>
        <h3>📂 Files</h3>
        {tree.map(n => (
          <TreeNode key={n.path} node={n} onSelect={selectFile} />
        ))}
      </div>

      {/* Preview */}
      <div style={{ width: "50%", padding: 10 }}>
        <h3>🧾 Code Preview</h3>
        <pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
          {preview || "Select a file"}
        </pre>
      </div>

      {/* Actions */}
      <div style={{ width: "25%", borderLeft: "1px solid #ccc", padding: 10 }}>
        <h3>⚡ Actions</h3>

        <div>
          <b>Selected:</b>
          {selectedFiles.map(f => (
            <div key={f} style={{ fontSize: 12 }}>{f}</div>
          ))}
        </div>

        <button
          onClick={exportTXT}
          style={{
            marginTop: 20,
            background: "green",
            color: "#fff",
            padding: 10,
            borderRadius: 6,
          }}
        >
          Export TXT
        </button>
      </div>

    </div>
  )
}