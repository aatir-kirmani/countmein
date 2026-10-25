"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { COMPENSATION, SKILLS, STAGES } from "@/lib/constants";
import type { Compensation, Openness, Project, Slot, Stage } from "@/lib/types";
import { TagPicker } from "@/components/ui/TagPicker";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { ChoiceCards, Field, FormSection, Segmented, StickyActions } from "@/components/ui/Form";
import { useApp } from "@/components/Providers";
import { normalizeUrl } from "./ProfileExtras";

type SlotDraft = { id?: string; specialty: string; description: string; commitment: string; compensation: Compensation; status: Slot["status"] };
const TECH = ["Next.js", "React", "Node", "Python", "Supabase", "Postgres", "Swift", "Flutter", "AI/LLM", "Stripe", "No-code"];
const STAGE_META: Record<Stage, { icon: string; description: string }> = {
  idea: { icon: "💡", description: "Still on the napkin" },
  building: { icon: "🛠️", description: "Heads down, shipping" },
  launched: { icon: "🚀", description: "Live, finding users" },
  revenue: { icon: "💰", description: "People are paying" },
};
const COMP_STYLE: Record<Compensation, string> = {
  equity: "bg-amber-200 text-amber-950", paid: "bg-emerald-200 text-emerald-950", rev_share: "bg-sky-200 text-sky-950",
  unpaid: "bg-rose-200 text-rose-950", tbd: "bg-zinc-200 text-zinc-900",
};
const emptySlot = (): SlotDraft => ({ specialty: "", description: "", commitment: "", compensation: "tbd", status: "open" });

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
      : [emptySlot()]
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
    <form onSubmit={save} className="space-y-4">
      <FormSection step={1} title="What are you building?" description="The stuff people see on your card.">
        <Field label="Project name" htmlFor="pn" required counter={{ value: name.length, max: 60 }}>
          <input id="pn" required maxLength={60} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="BuildFast" />
        </Field>
        <Field label="One-line pitch" htmlFor="pp" required counter={{ value: pitch.length, max: 100 }} hint="Make it obvious in one glance. Pretend it's on a sticky note.">
          <input id="pp" required maxLength={100} className="input" value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="Stripe for indie game devs" />
        </Field>
        <ImageUpload label="Logo or screenshot" value={logo} onChange={setLogo} userId={userId} hint="Square works best. Optional, but cards with images get more taps." />
      </FormSection>

      <FormSection step={2} title="Where's it at?">
        <fieldset>
          <legend className="sr-only">Stage</legend>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {STAGES.map((st) => {
              const on = stage === st.value;
              return (
                <label key={st.value}
                  className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl px-2 py-4 text-center ring-1 ring-inset transition active:scale-[.98] ${
                    on ? "bg-violet-50 ring-2 ring-brand dark:bg-violet-950/40 dark:ring-violet-400" : "bg-zinc-50 ring-zinc-200 hover:ring-zinc-300 dark:bg-zinc-900/60 dark:ring-zinc-800"
                  }`}>
                  <input type="radio" name="stage" value={st.value} checked={on} onChange={() => setStage(st.value)} className="sr-only" />
                  <span aria-hidden className={`text-2xl transition ${on ? "scale-110" : ""}`}>{STAGE_META[st.value].icon}</span>
                  <span className="font-bold">{st.label}</span>
                  <span className="text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">{STAGE_META[st.value].description}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </FormSection>

      <FormSection step={3} title="Who do you need?" description="This decides who sees a “Count me in” button.">
        <ChoiceCards
          label="Open to collaborators?" columns={3} value={openness} onChange={setOpenness}
          options={[
            { value: "specific", label: "Specific roles", icon: "🎯", description: "List the skills you need" },
            { value: "anyone", label: "Anyone", icon: "🙌", description: "Curious people welcome" },
            { value: "closed", label: "Just showing", icon: "👀", description: "Not looking right now" },
          ]}
        />

        {openness === "specific" && (
          <div className="space-y-3">
            {drafts.map((d, i) => (
              <div key={d.id ?? `new-${i}`} className="relative rounded-3xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/60 dark:ring-zinc-800">
                <div className="mb-4 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 font-display font-extrabold">
                    <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-lg bg-lime-300 text-xs text-zinc-900">{i + 1}</span>
                    {d.specialty.trim() ? `Need: ${d.specialty}` : "Open role"}
                  </span>
                  {drafts.length > 1 && (
                    <button type="button" className="btn-ghost btn-sm text-zinc-500" onClick={() => setDrafts((x) => x.filter((_, j) => j !== i))} aria-label={`Remove role ${i + 1}`}>
                      Remove
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  <Field label="Specialty" htmlFor={`sp${i}`} required>
                    <input id={`sp${i}`} list="skill-list" className="input" value={d.specialty} onChange={(e) => setDraft(i, { specialty: e.target.value })} placeholder="Design/UI/UX" />
                  </Field>
                  <div className="-mt-2 flex flex-wrap gap-1.5">
                    {SKILLS.filter((x) => x !== "Other").slice(0, 8).map((sk) => (
                      <button key={sk} type="button" onClick={() => setDraft(i, { specialty: sk })}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${d.specialty === sk ? "bg-brand text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800"}`}>
                        {sk}
                      </button>
                    ))}
                  </div>
                  <Field label="What's the job?" htmlFor={`sd${i}`} optional counter={{ value: d.description.length, max: 200 }}>
                    <input id={`sd${i}`} className="input" maxLength={200} value={d.description} onChange={(e) => setDraft(i, { description: e.target.value })} placeholder="Landing page and onboarding flow" />
                  </Field>
                  <Field label="Time commitment" htmlFor={`sc${i}`} optional>
                    <input id={`sc${i}`} className="input" value={d.commitment} onChange={(e) => setDraft(i, { commitment: e.target.value })} placeholder="About 5 hrs a week" />
                  </Field>
                  <fieldset>
                    <legend className="label">What&apos;s in it for them?</legend>
                    <div className="flex flex-wrap gap-2">
                      {COMPENSATION.map((c) => {
                        const on = d.compensation === c.value;
                        return (
                          <button key={c.value} type="button" aria-pressed={on} onClick={() => setDraft(i, { compensation: c.value as Compensation })}
                            className={`min-h-[40px] rounded-full px-4 text-sm font-bold transition active:scale-95 ${on ? `${COMP_STYLE[c.value as Compensation]} ring-2 ring-zinc-900 dark:ring-white` : "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800"}`}>
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  {d.id && (
                    <Segmented
                      label="Status" value={d.status} onChange={(v) => setDraft(i, { status: v })}
                      options={[{ value: "open", label: "Open" }, { value: "filled", label: "Filled" }, { value: "closed", label: "Closed" }]}
                    />
                  )}
                </div>
              </div>
            ))}
            <datalist id="skill-list">{SKILLS.map((sk) => <option key={sk} value={sk} />)}</datalist>
            <button type="button" onClick={() => setDrafts((x) => [...x, emptySlot()])}
              className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-zinc-300 text-sm font-bold text-zinc-600 transition hover:border-brand hover:text-brand dark:border-zinc-700 dark:text-zinc-400">
              <span aria-hidden className="text-lg">＋</span> Add another role
            </button>
          </div>
        )}
        {openness === "anyone" && (
          <Field label="A note for helpers" htmlFor="gn" optional counter={{ value: note.length, max: 200 }}>
            <input id="gn" className="input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Happy to have anyone curious help test" />
          </Field>
        )}
      </FormSection>

      <FormSection step={4} title="The details" description="Optional, for people who tap through to your page.">
        <Field label="Description" htmlFor="pd" optional>
          <textarea id="pd" rows={4} className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="The problem, who it's for, and what's working so far." />
        </Field>
        <Field label="Link" htmlFor="pl" optional hint="Website, demo or repo.">
          <input id="pl" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="buildfast.com" />
        </Field>
        <TagPicker label="Tech stack" options={TECH} value={tech} onChange={setTech} />
      </FormSection>

      {project && (
        <div className="flex items-center justify-between gap-4 rounded-3xl p-4 ring-1 ring-inset ring-red-200 dark:ring-red-900/60">
          <div>
            <p className="font-bold text-red-700 dark:text-red-400">Delete project</p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">Removes it from every event and deletes its project space.</p>
          </div>
          <button type="button" className="btn-danger btn-sm shrink-0" onClick={remove}>Delete</button>
        </div>
      )}

      <StickyActions>
        <p className="hidden min-w-0 flex-1 truncate text-sm text-zinc-500 sm:block dark:text-zinc-400">
          {eventCode ? `Goes live on event ${eventCode} as soon as you post.` : project ? "Changes show up on every board right away." : "You can bring it to any event with one tap."}
        </p>
        <button className="btn-primary w-full sm:w-auto sm:min-w-[200px]" disabled={busy || !name.trim() || !pitch.trim()}>
          {busy ? "Saving…" : eventCode ? "Post to the board" : project ? "Save changes" : "Create project"}
        </button>
      </StickyActions>
    </form>
  );
}
