import MoodOrb from './MoodOrb'

export default function IntensitySlider({ value, onChange, color }) {
  return (
    <div className="field">
      <p className="field-label">02 &nbsp; 这份颜色，有多浓？</p>
      <div className="intensity-inner">
        <MoodOrb color={color} intensity={value} />
        <div className="slider-wrap">
          <div className="slider-ticks">
            <span>淡淡的</span>
            <span>很浓烈</span>
          </div>
          <input
            className="range-input"
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            style={{ '--fill': `${value}%`, '--selected': color }}
            aria-label="调节颜色深浅"
          />
          <div className="intensity-value">{value}%</div>
        </div>
      </div>
    </div>
  )
}
