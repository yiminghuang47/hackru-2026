"use client";

import Editor from "@monaco-editor/react";
import type { Language } from "@/lib/types";

export function CodeEditor({
  language,
  value,
  onChange,
}: {
  language: Language;
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <Editor
      height="100%"
      theme="vs-dark"
      language={language}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      loading={<div className="p-4 text-sm text-zinc-500">Loading editor…</div>}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 4,
        automaticLayout: true,
        padding: { top: 12 },
      }}
    />
  );
}
