
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FileInputProps {
  id: string;
  name: string;
  label: string;
  onFileChange: (file: File) => void;
  initialPreview?: string;
}

export const FileInput: React.FC<FileInputProps> = ({
  id,
  name,
  label,
  onFileChange,
  initialPreview,
}) => {
  const [preview, setPreview] = useState<string | undefined>(initialPreview);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileChange(file);
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="file"
        onChange={handleFileChange}
      />
      {preview && (
        <div className="mt-2">
          <img
            src={preview}
            alt="Preview"
            className="max-h-40 rounded-md border border-gray-200"
          />
        </div>
      )}
    </div>
  );
};
