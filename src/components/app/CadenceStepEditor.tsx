import type {
  CadenceChannel,
  CadenceRecipients,
  CadenceStep,
  CadenceTone,
} from "@/lib/schemas/accounts";

const TONES: CadenceTone[] = ["Gentle", "Standard", "Firm"];

const CHANNELS: { value: CadenceChannel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "both", label: "Email + WhatsApp" },
  { value: "voice", label: "Voice call" },
];

const RECIPIENTS: { value: CadenceRecipients; label: string }[] = [
  { value: "p0", label: "P0" },
  { value: "p0p1", label: "P0 + P1" },
  { value: "p0p1p2", label: "P0 + P1 + P2" },
];

type Props = {
  step: CadenceStep;
  defaultStep: CadenceStep;
  disabled: boolean;
  onChange: (patch: Partial<CadenceStep>) => void;
};

export function CadenceStepEditor({
  step,
  defaultStep,
  disabled,
  onChange,
}: Props) {
  const differs =
    step.tone !== defaultStep.tone ||
    step.channel !== defaultStep.channel ||
    step.recipients !== defaultStep.recipients;

  const voiceHintId = `${step.key}-voice-hint`;

  return (
    <li
      className={`rounded-card border border-hairline bg-card p-4 ${
        differs ? "border-l-2 border-l-warn" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-body font-semibold text-fg">{step.label}</span>
          {differs ? (
            <span className="rounded-pill bg-warn-tint px-2.5 py-0.5 text-pill font-semibold text-warn">
              Differs from default
            </span>
          ) : null}
        </div>
        {step.needs_approval ? (
          <span className="rounded-pill bg-alt px-2.5 py-0.5 text-pill font-semibold text-fg-soft">
            Needs approval
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <PillGroup
          legend={`Tone for ${step.label}`}
          name={`tone-${step.key}`}
          disabled={disabled}
          options={TONES.map((t) => ({ value: t, label: t }))}
          value={step.tone}
          onChange={(v) => onChange({ tone: v as CadenceTone })}
        />

        <PillGroup
          legend={`Channel for ${step.label}`}
          name={`channel-${step.key}`}
          disabled={disabled}
          options={CHANNELS.map((c) => {
            const option = {
              value: c.value,
              label: c.label,
              disabled: !step.allowed_channels.includes(c.value),
            };
            return c.value === "voice"
              ? { ...option, describedBy: voiceHintId }
              : option;
          })}
          value={step.channel}
          onChange={(v) => onChange({ channel: v as CadenceChannel })}
        />

        {step.allowed_channels.includes("voice") ? null : (
          <p id={voiceHintId} className="text-prose font-normal text-fg-muted">
            Voice is available from +30 onwards.
          </p>
        )}

        <div>
          <label
            htmlFor={`recipients-${step.key}`}
            className="text-eyebrow font-semibold uppercase tracking-[0.08em] text-fg-muted"
          >
            Recipients
          </label>
          <select
            id={`recipients-${step.key}`}
            value={step.recipients}
            disabled={disabled}
            onChange={(e) =>
              onChange({ recipients: e.target.value as CadenceRecipients })
            }
            className="mt-1.5 w-full rounded-input border border-stroke bg-card px-3 py-2 text-body font-semibold text-fg disabled:opacity-55"
          >
            {RECIPIENTS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </li>
  );
}

/**
 * Segmented pills backed by real radio inputs. The input is visually hidden
 * rather than removed, so the group is a genuine radiogroup — arrow keys move
 * between options and the selection is announced.
 */
function PillGroup({
  legend,
  name,
  options,
  value,
  disabled,
  onChange,
}: {
  legend: string;
  name: string;
  options: {
    value: string;
    label: string;
    disabled?: boolean;
    describedBy?: string;
  }[];
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const checked = option.value === value;
          const isDisabled = disabled || Boolean(option.disabled);
          return (
            <label
              key={option.value}
              className={`rounded-pill border px-3 py-1.5 text-pill font-semibold transition-colors duration-150 ${
                checked
                  ? "border-accent-edge bg-accent-tint text-accent"
                  : "border-stroke bg-card text-fg-soft"
              } ${
                isDisabled
                  ? "cursor-not-allowed opacity-45"
                  : "cursor-pointer hover:bg-hovered"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                disabled={isDisabled}
                aria-describedby={option.describedBy}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
