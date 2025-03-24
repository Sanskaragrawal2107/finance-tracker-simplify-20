
import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

// Modified component that just renders a simple div
// This prevents the slider from being used while maintaining the interface
const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => {
  // Extract the props that are causing type errors
  const { defaultValue, value, onValueChange, onValueCommit, ...divProps } = props;
  
  return (
    <div 
      className={cn("w-full", className)}
      {...divProps}
    >
      <div className="text-xs text-muted-foreground">Slider component is disabled</div>
    </div>
  );
})
Slider.displayName = "DisabledSlider"

export { Slider }
