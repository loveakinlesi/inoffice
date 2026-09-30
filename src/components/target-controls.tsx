import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet, FieldTitle } from '@/components/ui/field.tsx';
import { Input } from '@/components/ui/input.tsx';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select.tsx';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group.tsx';
import { REGION_NAMES } from '@/lib/constants.ts';
import { track } from '@/lib/analytics.ts';
import type { AttendanceMode, Region, Settings } from '@/lib/types.ts';

/** Form-level draft of the target: the percentage stays a string while being edited. */
export interface TargetDraft {
  attendanceMode: AttendanceMode;
  targetPercentage: string;
  targetDaysPerWeek: number;
}

const DAY_OPTIONS = Array.from({ length: 9 }, (_, i) => 1 + i / 2);
const MODES: { value: AttendanceMode; title: string; copy: string }[] = [
  { value: 'percentage', title: 'Percentage', copy: 'I need to be in the office for a percentage of my working days.' },
  { value: 'days', title: 'Days per week', copy: 'I need to be in the office a certain number of days each week.' },
];

export const targetDescription = (s: Settings) => s.attendanceMode === 'days'
  ? `${s.targetDaysPerWeek} office day${s.targetDaysPerWeek === 1 ? '' : 's'} per week`
  : `${s.targetPercentage}% of working days`;

export const toTargetDraft = (s: Settings): TargetDraft => ({
  attendanceMode: s.attendanceMode,
  targetPercentage: String(s.targetPercentage),
  targetDaysPerWeek: s.targetDaysPerWeek ?? 2.5,
});

export function applyTargetDraft(previous: Settings, d: TargetDraft): Settings {
  const days = d.attendanceMode === 'days' ? d.targetDaysPerWeek : null;
  return { ...previous, attendanceMode: d.attendanceMode, targetDaysPerWeek: days, targetPercentage: days === null ? Number(d.targetPercentage) : days / 5 * 100 };
}

export function TargetControls({ value, onChange }: { value: TargetDraft; onChange: (d: TargetDraft) => void }) {
  const days = value.attendanceMode === 'days';
  return (
    <FieldSet>
      <FieldLegend>Attendance target</FieldLegend>
      <RadioGroup
        name="attendanceMode"
        value={value.attendanceMode}
        onValueChange={mode => { onChange({ ...value, attendanceMode: mode as AttendanceMode }); track('target_mode_selected'); }}
        className="grid gap-3 sm:grid-cols-2"
      >
        {MODES.map(m => (
          <FieldLabel key={m.value} htmlFor={`mode-${m.value}`}>
            <Field orientation="horizontal">
              <RadioGroupItem id={`mode-${m.value}`} value={m.value} />
              <FieldContent>
                <FieldTitle>{m.title}</FieldTitle>
                <FieldDescription>{m.copy}</FieldDescription>
              </FieldContent>
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
      {days ? (
        <Field>
          <FieldLabel htmlFor="targetDaysPerWeek">Office days per week</FieldLabel>
          <NativeSelect
            id="targetDaysPerWeek"
            name="targetDaysPerWeek"
            className="w-full"
            value={value.targetDaysPerWeek}
            onChange={e => onChange({ ...value, targetDaysPerWeek: Number(e.target.value) })}
          >
            {DAY_OPTIONS.map(n => <NativeSelectOption key={n} value={n}>{n} day{n === 1 ? '' : 's'}</NativeSelectOption>)}
          </NativeSelect>
          <FieldDescription>Converted to a percentage of a five-day week for monthly calculations.</FieldDescription>
        </Field>
      ) : (
        <Field>
          <FieldLabel htmlFor="targetPercentage">Percentage of working days</FieldLabel>
          <Input
            id="targetPercentage"
            name="targetPercentage"
            type="number"
            min={5}
            max={100}
            step={5}
            required
            value={value.targetPercentage}
            onChange={e => onChange({ ...value, targetPercentage: e.target.value })}
          />
          <FieldDescription>Between 5% and 100%. For example, 50% of working days.</FieldDescription>
        </Field>
      )}
    </FieldSet>
  );
}

export function RegionControl({ value, onChange }: { value: Region; onChange: (r: Region) => void }) {
  return (
    <Field>
      <FieldLabel htmlFor="region" className="text-base">Which UK bank holiday calendar should we use?</FieldLabel>
      <NativeSelect id="region" name="region" className="w-full" value={value} onChange={e => onChange(e.target.value as Region)}>
        {Object.entries(REGION_NAMES).map(([v, n]) => <NativeSelectOption key={v} value={v}>{n}</NativeSelectOption>)}
      </NativeSelect>
    </Field>
  );
}
