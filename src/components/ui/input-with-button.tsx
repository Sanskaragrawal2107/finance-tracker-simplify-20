
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface InputWithButtonProps extends React.InputHTMLAttributes<HTMLInputElement> {
  buttonText: string;
  onButtonClick: () => void;
}

export const InputWithButton = React.forwardRef<HTMLInputElement, InputWithButtonProps>(
  ({ buttonText, onButtonClick, ...props }, ref) => {
    return (
      <div className="flex w-full items-center space-x-2">
        <Input ref={ref} {...props} />
        <Button type="button" onClick={onButtonClick}>
          {buttonText}
        </Button>
      </div>
    );
  }
);

InputWithButton.displayName = 'InputWithButton';
