
import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "./input"

interface SearchableSelectContentProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> {
  searchable?: boolean;
}

const SearchableSelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  SearchableSelectContentProps
>(({ className, children, position = "popper", searchable = true, ...props }, ref) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  
  // Filter viewport children based on search query
  const filteredChildren = React.Children.map(children, child => {
    // Check if child is a valid React element
    if (!React.isValidElement(child)) return child;
    
    if (child.type === SelectPrimitive.Viewport) {
      // Clone viewport element with filtered children
      return React.cloneElement(
        child,
        { ...child.props }, 
        React.Children.map(child.props.children, (viewportChild) => {
          if (!React.isValidElement(viewportChild)) return viewportChild;
          
          if (searchQuery && viewportChild.props) {
            let childText = '';
            
            // Extract text content from various child structures
            if (viewportChild.props && typeof viewportChild.props === 'object' && 'children' in viewportChild.props) {
              const childrenProp = viewportChild.props.children;
              
              if (typeof childrenProp === 'string') {
                childText = childrenProp;
              } else if (React.isValidElement(childrenProp)) {
                if (childrenProp.props && 
                    typeof childrenProp.props === 'object' &&
                    'children' in childrenProp.props) {
                  const children = childrenProp.props.children;
                  if (typeof children === 'string') {
                    childText = children;
                  }
                }
              }
            }
            
            if (childText && !childText.toLowerCase().includes(searchQuery.toLowerCase())) {
              return null;
            }
          }
          return viewportChild;
        })
      );
    }
    return child;
  });

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
          <ChevronUp className="h-4 w-4" />
        </SelectPrimitive.ScrollUpButton>
        
        {searchable && (
          <div className="sticky top-0 flex items-center p-1 bg-popover border-b">
            <Search className="h-4 w-4 ml-2 text-muted-foreground absolute" />
            <Input
              className="pl-8 h-8"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        
        {filteredChildren}
        
        <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
          <ChevronDown className="h-4 w-4" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

SearchableSelectContent.displayName = "SearchableSelectContent";

export { SearchableSelectContent };
