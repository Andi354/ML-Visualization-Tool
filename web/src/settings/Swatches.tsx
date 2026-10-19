interface Props {
  swatches: string[];
  value: string;
  /** The value is none of the swatches (edited by hand): it is used as it is and no swatch is marked. */
  custom?: boolean;
  onPick: (color: string) => void;
}

/** Colour swatches (v0.3.2, O). */
export function Swatches({ swatches, value, custom, onPick }: Props) {
  return (
    <div class="swatches" role="radiogroup" aria-label="Farbe">
      {swatches.map((c) => (
        <button key={c} class="sw" role="radio" aria-checked={!custom && c.toLowerCase() === value.toLowerCase()} aria-label={c} data-color={c} data-testid="swatch" style={{ background: c }} onClick={() => onPick(c)} />
      ))}
    </div>
  );
}
