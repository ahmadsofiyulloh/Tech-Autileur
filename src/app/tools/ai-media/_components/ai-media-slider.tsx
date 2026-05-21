"use client";

type AiMediaSliderProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
};

export function AiMediaSlider({ label, min, max, step, value, onChange, unit }: AiMediaSliderProps) {
  return (
    <div className="ai-media-slider">
      <div className="ai-media-slider__header">
        <label className="ai-media-slider__label">{label}</label>
        <span className="ai-media-slider__value">{value}{unit ?? ""}</span>
      </div>
      <input
        type="range"
        className="ai-media-slider__input"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
