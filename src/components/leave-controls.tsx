import { useState, type FormEvent } from 'react';
import { PencilIcon } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field.tsx';
import { Input } from '@/components/ui/input.tsx';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select.tsx';
import { cn } from '@/lib/utils.ts';
import { DEFAULT_LEAVE, cycleFor, cycleStartLabel, defaultCarryoverExpiry, maxDayForMonth, nextCycle, plural, type LeaveCycle } from '@/lib/leave.ts';
import { iso } from '@/lib/attendance.ts';
import type { LeaveSettings } from '@/lib/types.ts';

const MONTHS = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(new Date(2024, i, 1)));
const longDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const parse = (d: string) => new Date(`${d}T12:00:00`);

interface CarryDraft { days: string; expires: string }
export interface LeaveDraft { cycleStartMonth: number; cycleStartDay: number; allowance: string; current: CarryDraft; next: CarryDraft }

const asLeave = (d: Pick<LeaveDraft, 'cycleStartMonth' | 'cycleStartDay'>) => ({ ...DEFAULT_LEAVE, ...d });

export function toLeaveDraft(leave: LeaveSettings | null | undefined, now = new Date()): LeaveDraft {
  const l = leave ?? DEFAULT_LEAVE;
  const current = cycleFor(now, l);
  const row = (c: LeaveCycle): CarryDraft => {
    const entry = l.carryover[c.key];
    return { days: entry ? String(entry.days) : '', expires: entry?.expires ?? '' };
  };
  return { cycleStartMonth: l.cycleStartMonth, cycleStartDay: l.cycleStartDay, allowance: String(l.allowance), current: row(current), next: row(nextCycle(current, l)) };
}

/** Turns the form draft back into settings, keeping carryover for other cycles that still line up with the cycle start. */
export function applyLeaveDraft(previous: LeaveSettings | null | undefined, d: LeaveDraft, now = new Date()): LeaveSettings {
  const l = asLeave(d);
  const current = cycleFor(now, l);
  const carryover: LeaveSettings['carryover'] = {};
  const startSuffix = `-${String(d.cycleStartMonth).padStart(2, '0')}-${String(d.cycleStartDay).padStart(2, '0')}`;
  for (const [key, value] of Object.entries(previous?.carryover ?? {})) if (key.endsWith(startSuffix)) carryover[key] = value;
  for (const [cycle, row] of [[current, d.current], [nextCycle(current, l), d.next]] as const) {
    const days = Number(row.days);
    if (row.days.trim() !== '' && days > 0) carryover[cycle.key] = { days, expires: row.expires || null };
    else delete carryover[cycle.key];
  }
  return { cycleStartMonth: d.cycleStartMonth, cycleStartDay: d.cycleStartDay, allowance: Number(d.allowance), carryover };
}

export const leaveSummary = (l: LeaveSettings) => `${plural(l.allowance, 'day')} a year, cycle starts ${cycleStartLabel(l)}`;

function CarryRow({ cycle, value, onChange }: { cycle: LeaveCycle; value: CarryDraft; onChange: (v: CarryDraft) => void }) {
  const id = `carry-${cycle.key}`;
  const has = value.days.trim() !== '' && Number(value.days) > 0;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor={`${id}-days`}>Carried into {cycle.label}</FieldLabel>
        <Input id={`${id}-days`} name={`${id}-days`} type="number" inputMode="decimal" min={0} max={366} step={0.5} placeholder="0" value={value.days}
          onChange={e => {
            const days = e.target.value;
            const gaining = days.trim() !== '' && Number(days) > 0 && !has && value.expires === '';
            onChange({ days, expires: gaining ? defaultCarryoverExpiry(cycle) : value.expires });
          }} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-expires`}>Use by</FieldLabel>
        <Input id={`${id}-expires`} name={`${id}-expires`} type="date" disabled={!has} min={iso(cycle.start)} max={iso(cycle.end)} value={value.expires} onChange={e => onChange({ ...value, expires: e.target.value })} />
      </Field>
      <FieldDescription className="sm:col-span-2">
        {has && value.expires ? `Carried days not booked by ${longDate.format(parse(value.expires))} are lost.` : has ? 'No date set: carried days never expire.' : 'Leave blank if nothing was carried over.'}
      </FieldDescription>
    </div>
  );
}

export function LeaveControls({ value, onChange }: { value: LeaveDraft; onChange: (d: LeaveDraft) => void }) {
  const l = asLeave(value);
  const current = cycleFor(new Date(), l);
  const next = nextCycle(current, l);
  return (
    <FieldGroup>
      <FieldSet>
        <FieldLegend>Leave cycle</FieldLegend>
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
          <Field>
            <FieldLabel htmlFor="leaveStartMonth">Cycle starts</FieldLabel>
            <NativeSelect id="leaveStartMonth" name="leaveStartMonth" className="w-full" value={value.cycleStartMonth}
              onChange={e => { const m = Number(e.target.value); onChange({ ...value, cycleStartMonth: m, cycleStartDay: Math.min(value.cycleStartDay, maxDayForMonth(m)) }); }}>
              {MONTHS.map((m, i) => <NativeSelectOption key={m} value={i + 1}>{m}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="leaveStartDay">Day</FieldLabel>
            <NativeSelect id="leaveStartDay" name="leaveStartDay" className="w-full" value={value.cycleStartDay} onChange={e => onChange({ ...value, cycleStartDay: Number(e.target.value) })}>
              {Array.from({ length: maxDayForMonth(value.cycleStartMonth) }, (_, i) => <NativeSelectOption key={i} value={i + 1}>{i + 1}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
        </div>
        <FieldDescription>When your leave year begins, for example 1 January or 1 April. Now: {current.label} ({longDate.format(current.start)} to {longDate.format(current.end)}).</FieldDescription>
      </FieldSet>
      <Field>
        <FieldLabel htmlFor="leaveAllowance">Days granted each cycle</FieldLabel>
        <Input id="leaveAllowance" name="leaveAllowance" type="number" inputMode="decimal" required min={0} max={366} step={0.5} value={value.allowance} onChange={e => onChange({ ...value, allowance: e.target.value })} />
        <FieldDescription>Working days of leave, not counting bank holidays. Only days marked OOO use it up.</FieldDescription>
      </Field>
      <FieldSet>
        <FieldLegend>Carryover</FieldLegend>
        <CarryRow cycle={current} value={value.current} onChange={current => onChange({ ...value, current })} />
        <CarryRow cycle={next} value={value.next} onChange={next => onChange({ ...value, next })} />
      </FieldSet>
    </FieldGroup>
  );
}

/** Settings group body for leave: off → set up; on → summary with an inline edit form. */
export function LeaveSettingsBody({ leave, onSave, className }: { leave: LeaveSettings | null | undefined; onSave: (l: LeaveSettings | null) => boolean; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => toLeaveDraft(leave));
  const open = () => { setDraft(toLeaveDraft(leave)); setEditing(true); };
  const submit = (e: FormEvent) => { e.preventDefault(); if (onSave(applyLeaveDraft(leave, draft))) setEditing(false); };

  if (editing) {
    return (
      <form id="leaveForm" onSubmit={submit} className={cn('p-4', className)}>
        <FieldGroup>
          <LeaveControls value={draft} onChange={setDraft} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {leave && <Button type="button" variant="ghost" size="lg" className="text-destructive sm:mr-auto" onClick={() => { if (onSave(null)) setEditing(false); }}>Stop tracking leave</Button>}
            <Button type="button" variant="ghost" size="lg" onClick={() => setEditing(false)}>Cancel</Button>
            <Button type="submit" size="lg">Save leave</Button>
          </div>
        </FieldGroup>
      </form>
    );
  }
  if (!leave) {
    return (
      <div className="flex items-center justify-between gap-4 px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-sm font-medium">Track leave</p>
          <p className="text-sm leading-5 text-muted-foreground">Set your allowance and see whether the days you plan as OOO fit within it.</p>
        </div>
        <Button variant="outline" onClick={open}>Set up</Button>
      </div>
    );
  }
  const current = cycleFor(new Date(), leave);
  const carry = leave.carryover[current.key];
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
      <dl className="grid min-w-0 gap-2 text-sm">
        <div><dt className="text-muted-foreground">Allowance</dt><dd id="leaveAllowanceSummary" className="font-medium">{plural(leave.allowance, 'day')} per cycle</dd></div>
        <div><dt className="text-muted-foreground">Cycle starts</dt><dd className="font-medium">{cycleStartLabel(leave)} (now {current.label})</dd></div>
        <div>
          <dt className="text-muted-foreground">Carryover into {current.label}</dt>
          <dd className="font-medium">{carry ? `${plural(carry.days, 'day')}${carry.expires ? `, use by ${longDate.format(parse(carry.expires))}` : ', no expiry'}` : 'None'}</dd>
        </div>
      </dl>
      <Button variant="outline" aria-label="Edit leave settings" aria-expanded={false} aria-controls="leaveForm" onClick={open}>
        <PencilIcon data-icon="inline-start" />
        Edit
      </Button>
    </div>
  );
}
