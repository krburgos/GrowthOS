"use client";

import { Archive, ArrowDown, ArrowUp, MoreVertical, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STAGE_GROUP_BADGE_VARIANT, STAGE_GROUP_LABELS, type StageGroup } from "@/lib/opportunities/stages";
import { createClient } from "@/lib/supabase/client";

export interface StageRow {
  id: string;
  name: string;
  stage_group: StageGroup;
  sort_order: number;
  win_probability: number;
  is_default: boolean;
}

const GROUPS: StageGroup[] = ["open", "won", "lost"];

/**
 * Client-confirmed, this screen only, this exact stage only: the
 * "Lost" stage's badge reads as light-error red here instead of the
 * shared neutral-grey `STAGE_GROUP_BADGE_VARIANT` (§8.4) uses elsewhere
 * — the client wants "Lost" specifically to visually read as a dead
 * end on this management screen. This is keyed by name, not by group:
 * "Lost Resurrected" shares the same Lost group (so the board still
 * treats it as closed) but stays neutral-grey, since the client
 * confirmed only the literal "Lost" stage should turn red. The Kanban
 * board's "Lost/Stalled" column headers are untouched either way and
 * deliberately stay neutral so a stalled deal doesn't read as alarming
 * there.
 */
function settingsBadgeVariant(stage: Pick<StageRow, "name" | "stage_group">): "success" | "neutral" | "info" | "error" {
  if (stage.name.trim().toLowerCase() === "lost") return "error";
  return STAGE_GROUP_BADGE_VARIANT[stage.stage_group];
}

/** Clamps free-typed probability input to a valid 0-100 integer, same
 * range the `opportunity_stages_win_probability_range` check enforces
 * in the database. */
function parseProbability(value: string): number {
  const n = Math.round(Number(value));
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/**
 * Settings → Opportunity Stages. Client-confirmed deviation from the
 * Backend Schema's fixed 13-stage enum — customizable per account, same
 * add/rename/reorder/retire shape as Contact Statuses, plus a Group
 * (Open/Won/Lost) every stage must carry for the Kanban board's column
 * coloring and closed_at logic. Owner/Admin only, mirroring the exact
 * same restriction Contact Statuses already uses.
 *
 * Client-confirmed addition: every stage also carries an editable Win
 * Probability (0-100%) — the client's own pipeline forecast weighting,
 * not derived from anything else in the schema.
 */
export function StagesManager({
  stages,
  canEdit,
  accountId,
}: {
  stages: StageRow[];
  canEdit: boolean;
  accountId: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<StageRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editGroup, setEditGroup] = useState<StageGroup>("open");
  const [editProbability, setEditProbability] = useState("0");
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState<StageGroup>("open");
  const [newProbability, setNewProbability] = useState("0");
  const [retireTarget, setRetireTarget] = useState<StageRow | null>(null);

  const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order);

  const move = async (index: number, direction: -1 | 1) => {
    const other = sorted[index + direction];
    const current = sorted[index];
    if (!other) return;

    setPendingId(current.id);
    const supabase = createClient();
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("opportunity_stages").update({ sort_order: other.sort_order }).eq("id", current.id),
      supabase.from("opportunity_stages").update({ sort_order: current.sort_order }).eq("id", other.id),
    ]);
    setPendingId(null);

    if (e1 || e2) {
      toast.error(e1?.message ?? e2?.message ?? "Couldn't reorder.");
      return;
    }
    router.refresh();
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setPendingId("new");
    const supabase = createClient();
    const nextSortOrder = sorted.length > 0 ? Math.max(...sorted.map((s) => s.sort_order)) + 1 : 0;
    const { error } = await supabase.from("opportunity_stages").insert({
      account_id: accountId,
      name: newName.trim(),
      stage_group: newGroup,
      sort_order: nextSortOrder,
      win_probability: parseProbability(newProbability),
    });
    setPendingId(null);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Stage added.");
    setNewName("");
    setNewGroup("open");
    setNewProbability("0");
    setAddOpen(false);
    router.refresh();
  };

  const handleEdit = async () => {
    if (!editTarget || !editName.trim()) return;
    setPendingId(editTarget.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("opportunity_stages")
      .update({ name: editName.trim(), stage_group: editGroup, win_probability: parseProbability(editProbability) })
      .eq("id", editTarget.id);
    setPendingId(null);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Stage updated.");
    setEditTarget(null);
    router.refresh();
  };

  const handleRetire = async () => {
    if (!retireTarget) return;
    setPendingId(retireTarget.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("opportunity_stages")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", retireTarget.id);
    setPendingId(null);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(`${retireTarget.name} retired.`);
    setRetireTarget(null);
    router.refresh();
  };

  return (
    <div className="flex w-full flex-col gap-4">
      {canEdit && (
        <Button size="sm" className="self-start" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 size-4" />
          Add Stage
        </Button>
      )}

      <ul className="flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200">
        {sorted.map((stage, index) => (
          <li key={stage.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="text-body text-neutral-800">{stage.name}</span>
              <Badge variant={settingsBadgeVariant(stage)}>
                {STAGE_GROUP_LABELS[stage.stage_group]}
              </Badge>
              <span className="text-body-sm tabular-nums text-neutral-500">{stage.win_probability}%</span>
            </div>
            {canEdit && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={index === 0 || pendingId === stage.id}
                  onClick={() => move(index, -1)}
                  className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
                  aria-label={`Move ${stage.name} up`}
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={index === sorted.length - 1 || pendingId === stage.id}
                  onClick={() => move(index, 1)}
                  className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
                  aria-label={`Move ${stage.name} down`}
                >
                  <ArrowDown className="size-4" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
                      aria-label={`More actions for ${stage.name}`}
                    >
                      <MoreVertical className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => {
                        setEditTarget(stage);
                        setEditName(stage.name);
                        setEditGroup(stage.stage_group);
                        setEditProbability(String(stage.win_probability));
                      }}
                    >
                      <Pencil className="mr-2 size-4 text-neutral-400" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-error-700 data-[highlighted]:bg-error-50"
                      onSelect={() => setRetireTarget(stage)}
                    >
                      <Archive className="mr-2 size-4" />
                      Retire
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a stage</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="new-stage-name" required>
              Name
            </Label>
            <Input id="new-stage-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="new-stage-group" required>
              Group
            </Label>
            <Select value={newGroup} onValueChange={(v) => setNewGroup(v as StageGroup)}>
              <SelectTrigger id="new-stage-group">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUPS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {STAGE_GROUP_LABELS[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="new-stage-probability" required>
              Win Probability
            </Label>
            <div className="relative">
              <Input
                id="new-stage-probability"
                type="number"
                min={0}
                max={100}
                className="pr-7"
                value={newProbability}
                onChange={(e) => setNewProbability(e.target.value)}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-body-sm text-neutral-400">
                %
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={pendingId === "new"}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit stage</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="edit-stage-name" required>
              Name
            </Label>
            <Input id="edit-stage-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="edit-stage-group" required>
              Group
            </Label>
            <Select value={editGroup} onValueChange={(v) => setEditGroup(v as StageGroup)}>
              <SelectTrigger id="edit-stage-group">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUPS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {STAGE_GROUP_LABELS[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="edit-stage-probability" required>
              Win Probability
            </Label>
            <div className="relative">
              <Input
                id="edit-stage-probability"
                type="number"
                min={0}
                max={100}
                className="pr-7"
                value={editProbability}
                onChange={(e) => setEditProbability(e.target.value)}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-body-sm text-neutral-400">
                %
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={pendingId === editTarget?.id}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!retireTarget} onOpenChange={(o) => !o && setRetireTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retire stage</DialogTitle>
          </DialogHeader>
          <p className="text-body text-neutral-600">
            {retireTarget?.name} will no longer be available to assign to opportunities. Existing
            opportunities keep this stage until changed.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRetireTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRetire}
              disabled={pendingId === retireTarget?.id}
            >
              Retire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
