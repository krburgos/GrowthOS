"use client";

import { ChevronDown, Filter, MoreHorizontal, Search, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FileViewer, KindChip, downloadFile, fileMeta } from "@/components/growth-mission/mission-file-bits";
import { OwnerAvatar } from "@/components/growth-mission/order-bits";
import { useSectionView } from "@/components/growth-mission/section-switcher";
import { NAVY_GRADIENT } from "@/components/shell/hero-band";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { ACCEPT, canPreview, uploadMissionFile, type MissionFile } from "@/lib/growth-mission/files";
import { formatFileSize, formatReportDate } from "@/lib/growth-mission/reports";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Show = "all" | "general" | "orders";

const COLS = "grid grid-cols-[minmax(260px,1fr)_240px_170px_88px_72px_96px] items-center gap-x-3";
const HEAD = "text-caption font-bold uppercase tracking-wide text-primary-700";
const GENERAL = "__general__";

/**
 * The Arsenal (client-confirmed, 2026-10-20, approved mockup "The Arsenal"):
 * the Mission Card's file library, between the Hours panel and Mission
 * Orders, in the same blue frame as the Mission Orders table. A file is the
 * card's in general or one order's; the order panel shows that order's.
 *
 * Collapsible from its title bar, remembered per person and Mission Card;
 * dropping a file on it while collapsed still uploads and opens it. Upload
 * and the ⋯ menu are for the roles that can edit Mission Orders; everyone
 * else can view and download. Removing a file archives it.
 */
export function Arsenal({
  accountId,
  slug,
  files,
  orders,
  canEdit,
  focusSlot,
}: {
  accountId: string;
  slug: string;
  files: MissionFile[];
  /** This card's orders, for attaching a file to one. */
  orders: { id: string; title: string }[];
  canEdit: boolean;
  /** The Mission Card's Focus button (2026-10-22). */
  focusSlot?: React.ReactNode;
}) {
  const router = useRouter();
  const storageKey = `growthmission.arsenal.collapsed.${slug}`;
  const [collapsed, setCollapsed] = useState(false);
  // Focusing the Arsenal always shows its files, whatever its own collapse says.
  const focused = useSectionView() === "arsenal";
  const [show, setShow] = useState<Show>("all");
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [viewing, setViewing] = useState<MissionFile | null>(null);
  const [moving, setMoving] = useState<MissionFile | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(storageKey) === "1");
    } catch {
      // Storage blocked: open.
    }
  }, [storageKey]);

  const toggle = (next = !collapsed) => {
    setCollapsed(next);
    try {
      window.localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      // Storage blocked: this visit only.
    }
  };

  const upload = async (list: FileList | File[]) => {
    const picked = Array.from(list);
    if (!canEdit || picked.length === 0) return;
    toggle(false);
    setUploading(picked.map((f) => f.name));
    const supabase = createClient();
    let saved = 0;
    for (const file of picked) {
      const { error } = await uploadMissionFile(supabase, { accountId, slug, taskId: null, file });
      if (error) toast.error(error);
      else saved += 1;
      setUploading((u) => u.filter((n) => n !== file.name));
    }
    if (saved > 0) {
      toast.success(`${saved} ${saved === 1 ? "file" : "files"} added to the Arsenal.`);
      router.refresh();
    }
  };

  const archive = async (file: MissionFile) => {
    const { error } = await createClient()
      .from("growth_mission_files")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", file.id);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(`${file.file_name} removed.`);
    router.refresh();
  };

  const onOrders = files.filter((f) => f.task_id).length;
  const totalBytes = files.reduce((s, f) => s + (f.file_size ?? 0), 0);
  const q = query.trim().toLowerCase();
  const visible = files.filter(
    (f) =>
      (show === "all" || (show === "general" ? !f.task_id : !!f.task_id)) &&
      (!q || f.file_name.toLowerCase().includes(q))
  );
  const open = (f: MissionFile) => (canPreview(f.file_name) ? setViewing(f) : void downloadFile(f));

  const dropProps = canEdit
    ? {
        onDragOver: (e: React.DragEvent) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragging(true);
        },
        onDragLeave: (e: React.DragEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setDragging(false);
          void upload(e.dataTransfer.files);
        },
      }
    : {};

  const pill = (value: Show, label: string, count: number) => (
    <button
      type="button"
      aria-pressed={show === value}
      onClick={() => setShow(value)}
      className={cn(
        "inline-flex h-8 items-center rounded-full border px-3 text-caption font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40 motion-reduce:transition-none",
        show === value ? "border-primary-700 bg-primary-50 text-primary-900" : "border-neutral-300 bg-white text-neutral-500 hover:text-primary-900"
      )}
    >
      {label} {count}
    </button>
  );

  return (
    <section
      id="arsenal"
      {...dropProps}
      className={cn(
        "overflow-hidden rounded-xl border bg-white transition-shadow motion-reduce:transition-none",
        dragging ? "border-secondary-500 ring-2 ring-secondary-500/40" : "border-primary-200"
      )}
    >
      <div className={`flex flex-wrap items-center gap-3 px-5 py-4 ${NAVY_GRADIENT}`}>
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => toggle()}
          title={collapsed ? "Expand the Arsenal" : "Collapse the Arsenal"}
          className="group flex min-w-0 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-300"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/10 text-white transition-colors group-hover:bg-white/20">
            <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", collapsed && "-rotate-90")} />
          </span>
          <span className="min-w-0">
            <span className="block text-h4 text-white">The Arsenal</span>
            <span className="mt-0.5 block text-body-sm tabular-nums text-secondary-300">
              {files.length === 0
                ? "No files yet"
                : `${files.length} ${files.length === 1 ? "file" : "files"}${totalBytes ? ` · ${formatFileSize(totalBytes)}` : ""} · ${onOrders} on Mission Orders`}
            </span>
          </span>
        </button>
        {focusSlot && <div className="ml-auto">{focusSlot}</div>}
        {canEdit && (
          <>
            <input
              ref={input}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const list = e.target.files;
                if (list) void upload(Array.from(list));
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              className="ml-auto border-transparent hover:border-transparent"
              onClick={() => input.current?.click()}
              disabled={uploading.length > 0}
            >
              <Upload className="mr-1.5 size-4" />
              {uploading.length > 0 ? "Uploading…" : "Upload files"}
            </Button>
          </>
        )}
      </div>

      {(!collapsed || focused) && (
        <>
          {files.length > 0 && (
            <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2.5 border-b border-primary-200 bg-primary-100 px-5 pb-3 pt-2.5">
              <span className="inline-flex h-8 items-center gap-1.5 pr-0.5 text-body-sm font-bold text-primary-900">
                <Filter className="size-4 text-secondary-700" aria-hidden="true" />
                Filter
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[11px] font-bold uppercase leading-none tracking-wide text-primary-700">Belongs to</span>
                <div className="flex flex-wrap gap-1">
                  {pill("all", "All", files.length)}
                  {pill("general", "General", files.length - onOrders)}
                  {pill("orders", "Mission Orders", onOrders)}
                </div>
              </div>
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-[11px] font-bold uppercase leading-none tracking-wide text-primary-700">Search</span>
                <span className="flex h-8 min-w-[200px] items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 focus-within:border-secondary-500 focus-within:ring-2 focus-within:ring-secondary-500/40">
                  <Search className="size-3.5 shrink-0 text-neutral-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="File name"
                    className="min-w-0 flex-1 bg-transparent text-body-sm text-neutral-800 outline-none placeholder:text-neutral-400"
                  />
                </span>
              </label>
            </div>
          )}

          {uploading.length > 0 && (
            <p className="border-b border-neutral-100 bg-secondary-50 px-5 py-2.5 text-body-sm text-secondary-800">
              Uploading {uploading.join(", ")}…
            </p>
          )}

          {files.length === 0 ? (
            <p className="px-5 py-10 text-center text-body-sm text-neutral-400">
              {canEdit ? "No files yet. Upload the first one, or drop files here." : "No files yet."}
            </p>
          ) : visible.length === 0 ? (
            <p className="px-5 py-8 text-center text-body-sm text-neutral-500">No files match these filters.</p>
          ) : (
            <>
              {/* Below lg, one card per file, like the Mission Orders table. */}
              <div className="flex flex-col gap-2.5 px-4 py-4 lg:hidden">
                {visible.map((f) => (
                  <article key={f.id} className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3.5">
                    <KindChip name={f.file_name} />
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => open(f)} className="block max-w-full truncate text-left text-body-sm font-semibold text-neutral-900 hover:underline">
                        {f.file_name}
                      </button>
                      <p className="text-caption text-neutral-500">{f.taskTitle ?? "General"}</p>
                      <p className="text-caption text-neutral-400">{fileMeta(f)}</p>
                    </div>
                    {canEdit && <FileMenu file={f} onMove={() => setMoving(f)} onArchive={() => void archive(f)} />}
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <div className="min-w-[960px]">
                  <div className={`${COLS} border-b border-primary-200 bg-primary-50 px-5 py-2 ${HEAD}`}>
                    <span>File</span>
                    <span>Belongs to</span>
                    <span>Uploaded by</span>
                    <span>Uploaded</span>
                    <span className="text-right">Size</span>
                    <span />
                  </div>
                  {visible.map((f) => (
                    <div key={f.id} className={`${COLS} min-h-[54px] border-b border-neutral-100 bg-white px-5 py-2 hover:bg-neutral-50/70`}>
                      <span className="flex min-w-0 items-center gap-3">
                        <KindChip name={f.file_name} />
                        <button
                          type="button"
                          onClick={() => open(f)}
                          title={f.file_name}
                          className="block min-w-0 truncate text-left text-body-sm font-semibold text-neutral-900 hover:underline"
                        >
                          {f.file_name}
                        </button>
                      </span>
                      {f.taskTitle ? (
                        <span className="block truncate text-body-sm text-neutral-700" title={f.taskTitle}>
                          {f.taskTitle}
                        </span>
                      ) : (
                        <span className="text-body-sm text-neutral-400">General</span>
                      )}
                      <span className="flex min-w-0 items-center gap-2">
                        <OwnerAvatar type={f.uploadedBy ? "internal" : null} name={f.uploadedBy ?? undefined} />
                        <span className="truncate text-body-sm text-neutral-700">{f.uploadedBy ?? "—"}</span>
                      </span>
                      <span className="text-body-sm tabular-nums text-neutral-600">{formatReportDate(f.created_at)}</span>
                      <span className="text-right text-body-sm tabular-nums text-neutral-700">{formatFileSize(f.file_size) ?? "—"}</span>
                      <span className="flex items-center justify-end gap-3">
                        <button type="button" onClick={() => open(f)} className="text-caption font-semibold text-secondary-700 hover:text-secondary-800">
                          {canPreview(f.file_name) ? "View" : "Download"}
                        </button>
                        {canEdit && <FileMenu file={f} onMove={() => setMoving(f)} onArchive={() => void archive(f)} />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-primary-200 bg-primary-100 px-5 py-2.5 text-caption text-primary-700">
            {canEdit && (
              <span className="inline-flex items-center gap-1.5">
                <Upload className="size-3.5" />
                Drop files anywhere on the Arsenal to upload
              </span>
            )}
            <span>
              PDF, Word, Excel, PowerPoint, images, CSV · up to <b className="font-semibold text-primary-900">25 MB</b> each
            </span>
          </div>
        </>
      )}

      {viewing && <FileViewer file={viewing} onClose={() => setViewing(null)} />}
      {moving && (
        <MoveDialog
          file={moving}
          orders={orders}
          onClose={() => setMoving(null)}
          onMoved={() => {
            setMoving(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

function FileMenu({ file, onMove, onArchive }: { file: MissionFile; onMove: () => void; onArchive: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`More for ${file.file_name}`}
          className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void downloadFile(file)}>Download</DropdownMenuItem>
        <DropdownMenuItem onSelect={onMove}>{file.task_id ? "Move…" : "Attach to a Mission Order…"}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onArchive} className="text-error-700">
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Move a file between "General" and one of this card's orders. */
function MoveDialog({
  file,
  orders,
  onClose,
  onMoved,
}: {
  file: MissionFile;
  orders: { id: string; title: string }[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const [target, setTarget] = useState(file.task_id ?? GENERAL);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await createClient()
      .from("growth_mission_files")
      .update({ task_id: target === GENERAL ? null : target })
      .eq("id", file.id);
    setSaving(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("File moved.");
    onMoved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Where does {file.file_name} belong?</DialogTitle>
        </DialogHeader>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger aria-label="Belongs to">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GENERAL}>General (the whole Mission Card)</SelectItem>
            {orders.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || target === (file.task_id ?? GENERAL)}>
            {saving ? "Saving…" : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
