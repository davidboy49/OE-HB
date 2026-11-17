"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { useEffect } from "react";

interface RichTextViewProps {
  value: string;
  className?: string;
}

/**
 * Read-only rich text with none of the editor chrome. The HTML goes through the editor's schema,
 * which drops anything it doesn't know (scripts, handlers, unknown tags), so stored content that
 * the server never sanitised is safe to show - unlike dangerouslySetInnerHTML.
 */
export default function RichTextView({ value, className }: RichTextViewProps) {
  const editor = useEditor({
    extensions: [StarterKit, Underline, Table, TableRow, TableHeader, TableCell],
    content: value,
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: `rich-text-view ${className ?? ""}` } },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value);
  }, [editor, value]);

  return <EditorContent editor={editor} />;
}
