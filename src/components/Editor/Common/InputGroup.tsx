/**
 * Input Group Component
 * Reusable 2-column input layout for numeric fields
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface InputField {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}

interface InputGroupProps {
  title: string;
  fields: [InputField, InputField]; // Exactly 2 fields for 2-column layout
}

export const InputGroup = ({ title, fields }: InputGroupProps) => {
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
              type="number"
              min={field.min}
              max={field.max}
              value={field.value}
              onChange={(e) => field.onChange(parseInt(e.target.value) || field.min)}
              className="h-8 text-sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
