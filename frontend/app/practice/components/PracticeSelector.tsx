interface PracticeSelectorProps {
  value: string;
  onChange: (type: string) => void;
}

const PRACTICE_TYPES = ['guitar', 'voice', 'drums', 'writing', 'composing', 'ear training'];

export default function PracticeSelector({ value, onChange }: PracticeSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      id="practice-selector"
    >
      {PRACTICE_TYPES.map((type) => (
        <option key={type} value={type}>
          {type}
        </option>
      ))}
    </select>
  );
}

