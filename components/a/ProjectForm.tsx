"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { COMPENSATION, SKILLS, STAGES } from "@/lib/constants";
import type { Compensation, Openness, Project, Slot, Stage } from "@/lib/types";
import { TagPicker } from "@/components/ui/TagPicker";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { useApp } from "@/components/Providers";
import { normalizeUrl } from "./ProfileExtras";

type SlotDraft = { id?: string; specialty: string; description: string; commitment: string; compensation: Compensation; status: Slot["status"] };
const TECH = ["Next.js", "React", "Node", "Python", "Supabase", "Postgres", "Swift", "Flutter", "AI/LLM", "Stripe", "No-code"];

export function ProjectForm({ userId, project, slots = [], eventCode }: { userId: string; project?: Project; slots?: Slot[]; eventCode?: string | null }) {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useApp();
  const [name, setName] = useState(project?.name ?? "");
  const [pitch, setPitch] = useState(project?.pitch ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [stage, setStage] = useState<Stage>(project?.stage ?? "idea");
  const [link, setLink] = useState(project?.link ?? "");
  const [logo, setLogo] = useState<string | null>(project?.logo_url ?? null);
  const [tech, setTech] = useState<string[]>(project?.tech_stack ?? []);
  const [openness, setOpenness] = useState<Openness>(project?.openness ?? "specific");
  const [note, setNote] = useState(project?.general_note ?? "");
  const [drafts, setDrafts] = useState<SlotDraft[]>(
    slots.length
      ? slots.map((s) => ({ id: s.id, specialty: s.specialty, description: s.description ?? "", commitment: s.commitment ?? "", compensation: s.compensation, status: s.status }))
      : [{ specialty: "", description: "", commitment: "", compensation: "tbd", status: "open" }]
  );
  const [busy, setBusy] = useState(false);

  const setDraft = (i: number, patch: Partial<SlotDraft>) => setDrafts((d) => d.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (openness === "specific" && !drafts.some((d) => d.specialty.trim())) {
      return toast("Add at least one role you need, or choose “Open to anyone”.", { kind: "error" });
    }
    setBusy(true);
    const row = {
      owner_id: userId, name: name.trim(), pitch: pitch.trim(), description: description || null, stage,
      link: normalizeUrl(link), logo_url: logo, tech_stack: tech, openness, general_note: openness === "anyone" ? note || null : null,
    };
    const res = project
      ? await supabase.from("projects").update(row).eq("id", project.id).select("id").single()
      : await supabase.from("projects").insert(row).select("id").single();
    if (res.error || !res.data) { setBusy(false); return toast(res.error?.message ?? "Could not save", { kind: "error" }); }
    const pid = res.data.id as string;

    // Sync slots: delete removed, update existing, insert new.
    const keep = drafts.filter((d) => openness === "specific" && d.specialty.trim());
    const removed = slots.filter((s) => !keep.some((d) => d.id === s.id)).map((s) => s.id);
    const ops: PromiseLike<{ error: { message: string } | null }>[] = [];
    if (removed.length) ops.push(supabase.from("project_slots").delete().in("id", removed));
    for (const d of keep) {
      const r = { project_id: pid, specialty: d.specialty.trim(), description: d.description || null, commitment: d.commitment || null, compensation: d.compensation, status: d.status };
      ops.push(d.id ? supabase.from("project_slots").update(r).eq("id", d.id) : supabase.from("project_slots").insert(r));
    }
    const results = await Promise.all(ops);
    const slotErr = results.find((r) => r.error)?.error;
    if (slotErr) toast(slotErr.message, { kind: "error" });

    if (eventCode) {
      const { data: ev } = await supabase.from("events").select("id").eq("code", eventCode).single();
      if (ev) {
        const { error } = await supabase.from("event_projects").upsert({ event_id: ev.id, project_id: pid }, { onConflict: "event_id,project_id", ignoreDuplicates: true });
        if (error) toast("Saved, but couldn't add to the event. Check in first.", { kind: "error" });
      }
      router.push(`/e/${eventCode}`);
    } else {
      toast("Project saved", { kind: "success" });
      router.push(`/p/${pid}`);
    }
    router.refresh();
  };

  const remove = async () => {
    if (!project || !confirm(`Delete ${project.name}? This also removes its project space.`)) return;
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    if (error) return toast(error.message, { kind: "error" });
    router.push("/me");
    router.refresh();
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <div>
        <label htmlFor="pn" className="label">Project name</label>
        <input id="pn" required maxLength={60} className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="pp" className="label">One-line pitch <span className="muted">({pitch.length}/100)</span></label>
        <input id="pp" required maxLength={100} className="input" value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="Stripe for indie game devs" />
      </div>
      <fieldset>
        <legend className="label">Stage</legend>
        <div className="grid grid-cols-4 gap-2">
          {STAGES.map((s) => (
            <button type="button" key={s.value} aria-pressed={stage === s.value} onClick={() => setStage(s.value)}
              className={`min-h-[44px] rounded-xl text-sm font-medium ring-1 ${stage === s.value ? "bg-brand text-white ring-brand" : "bg-white ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-700"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="label">Are you open to collaborators?</legend>
        {([
          ["specific", "Open to specific roles", "List the skills you need"],
          ["anyone", "Open to anyone", "General “come help”"],
          ["closed", "Closed", "Just showing what I'm building"],
        ] as const).map(([v, t, d]) => (
          <label key={v} className={`card flex cursor-pointer items-start gap-3 p-3 ${openness === v ? "ring-2 ring-brand" : ""}`}>
            <input type="radio" name="openness" className="mt-1 accent-violet-700" checked={openness === v} onChange={() => setOpenness(v)} />
            <span><span className="block font-medium">{t}</span><span className="muted text-sm">{d}</span></span>
          </label>
        ))}
      </fieldset>

      {openness === "specific" && (
        <div className="space-y-3">
          {drafts.map((d, i) => (
            <div key={d.id ?? i} className="card space-y-3 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Open slot {i + 1}</span>
                <button type="button" className="btn-ghost text-xs" onClick={() => setDrafts((x) => x.filter((_, j) => j !== i))}>Remove</button>
              </div>
              <div>
                <label className="label" htmlFor={`sp${i}`}>Specialty</label>
                <input id={`sp${i}`} list="skill-list" className="input" value={d.specialty} onChange={(e) => setDraft(i, { specialty: e.target.value })} placeholder="Design/UI/UX" />
              </div>
              <input aria-label="What's needed" className="input" maxLength={200} value={d.description} onChange={(e) => setDraft(i, { description: e.target.value })} placeholder="What do you need? e.g. landing page + onboarding flow" />
              <div className="grid grid-cols-2 gap-2">
                <input aria-label="Commitment" className="input" value={d.commitment} onChange={(e) => setDraft(i, { commitment: e.target.value })} placeholder="~5 hrs/week" />
                <select aria-label="Compensation" className="input" value={d.compensation} onChange={(e) => setDraft(i, { compensation: e.target.value as Compensation })}>
                  {COMPENSATION.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              {d.id && (
                <select aria-label="Slot status" className="input" value={d.status} onChange={(e) => setDraft(i, { status: e.target.value as Slot["status"] })}>
                  <option value="open">Open</option><option value="filled">Filled</option><option value="closed">Closed</option>
                </select>
              )}
            </div>
          ))}
          <datalist id="skill-list">{SKILLS.map((s) => <option key={s} value={s} />)}</datalist>
          <button type="button" className="btn-secondary w-full" onClick={() => setDrafts((x) => [...x, { specialty: "", description: "", commitment: "", compensation: "tbd", status: "open" }])}>
            + Add slot
          </button>
        </div>
      )}
      {openness === "anyone" && (
        <div>
          <label htmlFor="gn" className="label">Note (optional)</label>
          <input id="gn" className="input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Happy to have anyone curious help test" />
        </div>
      )}

      <details className="card p-3" open={!!project}>
        <summary className="cursor-pointer text-sm font-semibold">More details (optional)</summary>
        <div className="mt-3 space-y-4">
          <div>
            <label htmlFor="pd" className="label">Description</label>
            <textarea id="pd" rows={4} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pl" className="label">Link (website, demo, repo)</label>
            <input id="pl" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="buildfast.com" />
          </div>
          <ImageUpload label="Logo or screenshot" value={logo} onChange={setLogo} userId={userId} />
          <TagPicker label="Tech stack" options={TECH} value={tech} onChange={setTech} />
        </div>
      </details>

      <button className="btn-primary w-full" disabled={busy || !name.trim() || !pitch.trim()}>
        {busy ? "Saving…" : eventCode ? "Post to event" : project ? "Save changes" : "Create project"}
      </button>
      {project && <button type="button" className="btn-danger w-full" onClick={remove}>Delete project</button>}
    </form>
  );
}
