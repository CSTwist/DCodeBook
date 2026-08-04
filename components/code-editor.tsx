"use client";

import { useRef, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";

interface CodeEditorProps {
  id?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function CodeEditor({
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  value,
  onChange,
  className,
  placeholder,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const isMultiLine = start !== end && value.slice(start, end).includes("\n");

      let newValue = value;
      let newStart = start;
      let newEnd = end;

      if (e.shiftKey) {
        // Shift+Tab: Outdent selected line(s)
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const effectiveEnd = end > start && value[end - 1] === "\n" ? end - 1 : end;
        const lineEnd = value.indexOf("\n", effectiveEnd);
        const lineEndPos = lineEnd === -1 ? value.length : lineEnd;

        const originalText = value.slice(lineStart, lineEndPos);
        const lines = originalText.split("\n");

        let totalRemoved = 0;
        let firstLineRemoved = 0;
        let lastLineRemoved = 0;

        const newLines = lines.map((line, idx) => {
          let removeCount = 0;
          if (line.startsWith("  ")) {
            removeCount = 2;
          } else if (line.startsWith("\t")) {
            removeCount = 1;
          } else if (line.startsWith(" ")) {
            removeCount = 1;
          }
          if (idx === 0) firstLineRemoved = removeCount;
          if (idx === lines.length - 1) lastLineRemoved = removeCount;
          totalRemoved += removeCount;
          return line.slice(removeCount);
        });

        newValue = value.slice(0, lineStart) + newLines.join("\n") + value.slice(lineEndPos);

        const startLineOffset = start - lineStart;
        newStart = lineStart + Math.max(0, startLineOffset - firstLineRemoved);

        if (start === end) {
          newEnd = newStart;
        } else if (end > start && value[end - 1] === "\n") {
          newEnd = end - totalRemoved;
        } else {
          const lastLineStartOriginal =
            lineStart + lines.slice(0, -1).reduce((acc, l) => acc + l.length + 1, 0);
          const lastLineOffset = end - lastLineStartOriginal;
          const newLastLineStart =
            lineStart + newLines.slice(0, -1).reduce((acc, l) => acc + l.length + 1, 0);
          newEnd = newLastLineStart + Math.max(0, lastLineOffset - lastLineRemoved);
        }
      } else {
        // Tab (Indent)
        if (isMultiLine) {
          const lineStart = value.lastIndexOf("\n", start - 1) + 1;
          const effectiveEnd = end > start && value[end - 1] === "\n" ? end - 1 : end;
          const lineEnd = value.indexOf("\n", effectiveEnd);
          const lineEndPos = lineEnd === -1 ? value.length : lineEnd;

          const originalText = value.slice(lineStart, lineEndPos);
          const lines = originalText.split("\n");
          const newLines = lines.map((line) => "  " + line);

          newValue = value.slice(0, lineStart) + newLines.join("\n") + value.slice(lineEndPos);
          newStart = start + 2;
          newEnd = end + 2 * lines.length;
        } else {
          newValue = value.slice(0, start) + "  " + value.slice(end);
          newStart = start + 2;
          newEnd = start + 2;
        }
      }

      onChange(newValue);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = newStart;
          textareaRef.current.selectionEnd = newEnd;
        }
      }, 0);
    }
  }

  return (
    <Textarea
      id={id}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      className={className}
      placeholder={placeholder}
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
    />
  );
}

