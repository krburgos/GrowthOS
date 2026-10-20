"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Braces, ChevronDown, Italic, Link2, List, ListOrdered, Underline } from "lucide-react";
import { forwardRef, useImperativeHandle, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MERGE_FIELDS, type MergeKey } from "@/lib/email/merge-fields";
import { cn } from "@/lib/utils";

const CHIP_CLASS = "rounded-md bg-secondary-100 px-1.5 text-body-sm font-semibold text-secondary-800";

/** A fill-in field as one uneditable chip: <span data-merge-field="first_name">{First name}</span>. */
const MergeField = Node.create({
  name: "mergeField",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      field: {
        default: "first_name",
        parseHTML: (el) => el.getAttribute("data-merge-field"),
        renderHTML: (attrs) => ({ "data-merge-field": attrs.field }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-merge-field]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const label = MERGE_FIELDS.find((f) => f.key === node.attrs.field)?.label ?? node.attrs.field;
    return ["span", mergeAttributes(HTMLAttributes, { class: CHIP_CLASS }), `{${label}}`];
  },
  renderText({ node }) {
    const label = MERGE_FIELDS.find((f) => f.key === node.attrs.field)?.label ?? node.attrs.field;
    return `{${label}}`;
  },
});

/** "{First name}" typed or pasted as text becomes a chip as the editor loads it. */
function tokensToChips(html: string): string {
  return html.replace(/\{([A-Za-z ]+)\}/g, (match, label: string) => {
    const f = MERGE_FIELDS.find((m) => m.label.toLowerCase() === label.trim().toLowerCase());
    return f ? `<span data-merge-field="${f.key}">{${f.label}}</span>` : match;
  });
}

export interface RichTextEditorHandle {
  setContent: (html: string) => void;
  getHTML: () => string;
  insertField: (key: MergeKey) => void;
}

/**
 * The 1-1 email editor (client-confirmed, 2026-10-20; Tiptap, Tech Stack
 * Lockfile §5.3): bold, italic, underline, links, bullet and numbered
 * lists, and — when `fields` is on — fill-in fields as chips. Used by the
 * email dialog, Settings → Email Templates and the email signature.
 */
export const RichTextEditor = forwardRef<
  RichTextEditorHandle,
  {
    initialHtml?: string;
    onChange?: (html: string) => void;
    fields?: boolean;
    minHeight?: string;
    ariaLabel: string;
    className?: string;
  }
>(function RichTextEditor({ initialHtml = "", onChange, fields = false, minHeight = "160px", ariaLabel, className }, ref) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      MergeField,
    ],
    content: tokensToChips(initialHtml),
    editorProps: { attributes: { "aria-label": ariaLabel, class: "outline-none", style: `min-height:${minHeight}` } },
    onUpdate: ({ editor: e }) => onChange?.(e.getHTML()),
  });

  useImperativeHandle(
    ref,
    () => ({
      setContent: (html: string) => {
        editor?.commands.setContent(tokensToChips(html));
        onChange?.(editor?.getHTML() ?? html);
      },
      getHTML: () => editor?.getHTML() ?? "",
      insertField: (key: MergeKey) => editor?.chain().focus().insertContent({ type: "mergeField", attrs: { field: key } }).run(),
    }),
    [editor, onChange]
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-neutral-300 bg-white focus-within:border-secondary-500 focus-within:ring-2 focus-within:ring-secondary-500/40",
        className
      )}
    >
      <Toolbar editor={editor} fields={fields} />
      <EditorContent
        editor={editor}
        className="px-3 py-2.5 text-body text-neutral-800 [&_a]:text-primary-700 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
      />
    </div>
  );
});

function Toolbar({ editor, fields }: { editor: Editor | null; fields: boolean }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  if (!editor) return <div className="h-[41px] border-b border-neutral-200 bg-neutral-50" />;

  const btn = (active: boolean, label: string, onClick: () => void, icon: React.ReactNode) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded text-neutral-700 transition-colors hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40",
        active && "bg-primary-100 text-primary-900"
      )}
    >
      {icon}
    </button>
  );

  const applyLink = () => {
    const url = href.trim();
    if (!url) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: /^(https?:|mailto:)/i.test(url) ? url : `https://${url}` }).run();
    setLinkOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50 px-2 py-1.5">
      {btn(editor.isActive("bold"), "Bold", () => editor.chain().focus().toggleBold().run(), <Bold className="size-4" />)}
      {btn(editor.isActive("italic"), "Italic", () => editor.chain().focus().toggleItalic().run(), <Italic className="size-4" />)}
      {btn(editor.isActive("underline"), "Underline", () => editor.chain().focus().toggleUnderline().run(), <Underline className="size-4" />)}
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-neutral-200" />
      <Popover
        open={linkOpen}
        onOpenChange={(o) => {
          setLinkOpen(o);
          if (o) setHref((editor.getAttributes("link").href as string | undefined) ?? "");
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Link"
            title="Link"
            className={cn(
              "flex size-7 items-center justify-center rounded text-neutral-700 hover:bg-neutral-200",
              editor.isActive("link") && "bg-primary-100 text-primary-900"
            )}
          >
            <Link2 className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="flex w-72 flex-col gap-2">
          <Input
            autoFocus
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
            }}
            placeholder="https://example.com"
            aria-label="Link address"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={applyLink}>
              {href.trim() ? "Apply" : "Remove link"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {btn(editor.isActive("bulletList"), "Bullet list", () => editor.chain().focus().toggleBulletList().run(), <List className="size-4" />)}
      {btn(editor.isActive("orderedList"), "Numbered list", () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered className="size-4" />)}
      {fields && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              className="ml-auto inline-flex h-7 items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 text-caption font-semibold text-primary-700 hover:border-primary-700"
            >
              <Braces className="size-3.5" />
              Insert field
              <ChevronDown className="size-3.5 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {MERGE_FIELDS.map((f) => (
              <DropdownMenuItem
                key={f.key}
                onSelect={() => editor.chain().focus().insertContent({ type: "mergeField", attrs: { field: f.key } }).run()}
              >
                {f.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
