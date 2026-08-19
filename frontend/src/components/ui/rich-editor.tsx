"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { useEffect } from "react";
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  List, 
  ListOrdered, 
  Heading1, 
  Heading2, 
  Table as TableIcon, 
  Undo, 
  Redo,
  Trash2,
  ChevronDown
} from "lucide-react";

interface RichEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  editorClassName?: string;
  editable?: boolean;
}

export default function RichEditor({ value, onChange, placeholder = "Start typing...", editorClassName, editable = true }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {},
        orderedList: {},
        listItem: {},
      }),
      Underline,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    editable: editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm dark:prose-invert focus:outline-none ${editorClassName || "min-h-[200px] max-h-[500px]"} overflow-y-auto px-4 py-3 bg-card text-foreground ${editable ? "border-t border-border rounded-b-md" : "rounded-md border border-border/40"}`,
      },
    },
  });

  // Sync value if changed from outside (e.g. on load)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  // Sync editable state
  useEffect(() => {
    if (editor && editable !== undefined) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  if (!editor) {
    return (
      <div className="w-full min-h-[250px] border border-border rounded-md animate-pulse bg-muted/20" />
    );
  }

  const addTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  return (
    <div className={`w-full border rounded-md bg-card flex flex-col overflow-hidden ${editable ? "border-border focus-within:ring-1 focus-within:ring-ring focus-within:border-ring" : "border-border/40"}`}>
      {/* Toolbar */}
      {editable && (
        <div className="flex flex-wrap items-center gap-1 p-2 bg-muted/40 border-b border-border text-muted-foreground select-none">
        {/* Text formatting */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors ${editor.isActive("bold") ? "bg-muted text-foreground" : ""}`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors ${editor.isActive("italic") ? "bg-muted text-foreground" : ""}`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors ${editor.isActive("underline") ? "bg-muted text-foreground" : ""}`}
          title="Underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Headings */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors ${editor.isActive("heading", { level: 1 }) ? "bg-muted text-foreground" : ""}`}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors ${editor.isActive("heading", { level: 2 }) ? "bg-muted text-foreground" : ""}`}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors ${editor.isActive("bulletList") ? "bg-muted text-foreground" : ""}`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors ${editor.isActive("orderedList") ? "bg-muted text-foreground" : ""}`}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Table Operations */}
        <button
          type="button"
          onClick={addTable}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors ${editor.isActive("table") ? "bg-muted text-foreground" : ""}`}
          title="Insert Table (3x3)"
        >
          <TableIcon className="w-4 h-4" />
        </button>

        {editor.isActive("table") && (
          <>
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className="px-2 py-1 text-xs rounded hover:bg-muted hover:text-foreground border border-border"
              title="Add Column"
            >
              + Col
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className="px-2 py-1 text-xs rounded hover:bg-muted hover:text-foreground border border-border"
              title="Add Row"
            >
              + Row
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteTable().run()}
              className="p-1 text-xs rounded hover:bg-muted text-destructive border border-border hover:bg-destructive/10"
              title="Delete Table"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        <div className="w-px h-5 bg-border mx-1 flex-grow" />

        {/* Undo / Redo */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 rounded hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 rounded hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>
      )}

      {/* Editor Content Area */}
      <EditorContent editor={editor} />
    </div>
  );
}
