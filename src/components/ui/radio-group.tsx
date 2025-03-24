
import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
      ref={ref}
    />
  )
})
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="h-2.5 w-2.5 fill-current text-current" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
})
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

const BankRadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("space-y-2", className)}
      {...props}
      ref={ref}
    />
  )
})
BankRadioGroup.displayName = "BankRadioGroup"

const BankRadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> & {
    bankName: string;
    bankLogo?: string;
  }
>(({ className, bankName, bankLogo, ...props }, ref) => {
  return (
    <div className="relative">
      <RadioGroupPrimitive.Item
        ref={ref}
        className={cn(
          "peer sr-only",
          className
        )}
        {...props}
      >
      </RadioGroupPrimitive.Item>
      <label 
        htmlFor={props.id || props.value?.toString()}
        className="flex items-center gap-3 p-4 border rounded-md cursor-pointer transition-all hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
      >
        <div className="w-10 h-10 bg-primary/10 rounded-md flex items-center justify-center text-primary font-bold">
          {bankLogo || bankName.charAt(0)}
        </div>
        <div className="flex-1">
          <p className="font-medium">{bankName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Internet Banking</p>
        </div>
        <div className="w-5 h-5 rounded-full border border-muted-foreground flex items-center justify-center peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground">
          <div className="peer-data-[state=checked]:w-2.5 peer-data-[state=checked]:h-2.5 peer-data-[state=checked]:rounded-full peer-data-[state=checked]:bg-white"></div>
        </div>
      </label>
    </div>
  )
})
BankRadioGroupItem.displayName = "BankRadioGroupItem"

export { RadioGroup, RadioGroupItem, BankRadioGroup, BankRadioGroupItem }
