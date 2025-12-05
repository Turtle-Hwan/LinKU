/**
 * Input Group Component
 * Reusable 2-column input layout for numeric fields
 * Uses text input with validation for better UX
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface InputField {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
}

interface InputGroupProps {
  title: string;
  fields: [InputField, InputField]; // Exactly 2 fields for 2-column layout
}

export const InputGroup = ({ title, fields }: InputGroupProps) => {
  const handleChange = (field: InputField, value: string) => {
    // Allow empty string for easier editing
    if (value === '') {
      field.onChange('');
      return;
    }

    // Only allow numeric input
    if (/^\d+$/.test(value)) {
      field.onChange(value);
    }
  };

  const handleBlur = (field: InputField) => {
    // If empty or invalid, set to min
    if (field.value === '' || isNaN(Number(field.value))) {
      field.onChange(field.min.toString());
      return;
    }

    // Clamp value to min/max bounds
    const numValue = Number(field.value);
    if (numValue < field.min) {
      field.onChange(field.min.toString());
    } else if (numValue > field.max) {
      field.onChange(field.max.toString());
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">{title}</Label>
      <div className="grid grid-cols-2 gap-2">
        {fields.map((field) => (
          <div key={field.id}>
            <Label htmlFor={field.id} className="text-xs text-muted-foreground">
              {field.label}
            </Label>
            <Input
              id={field.id}
              type="text"
              inputMode="numeric"
              value={field.value}
              onChange={(e) => handleChange(field, e.target.value)}
              onBlur={() => handleBlur(field)}
              className="h-8 text-sm"
              placeholder={`${field.min}-${field.max}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
