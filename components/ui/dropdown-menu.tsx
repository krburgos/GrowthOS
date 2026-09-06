import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Tech Stack Lockfile §3.2 pins @radix-ui/react-dropdown-menu for the
 * user/account menu. Same radius-lg/shadow-md popover treatment as
 * Select's content (§6.1/§6.2).
 */
const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[10rem] overflow-hidden rounded-lg border border-neutral-200 bg-white p-1 shadow-md",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-body text-neutral-800 outline-none",
      "data-[highlighted]:bg-neutral-100",
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

/**
 * Multi-select menu item (Contacts column picker) — stays open on
 * click, unlike DropdownMenuItem, since toggling one checkbox
 * shouldn't dismiss the whole menu.
 */
const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, onSelect, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    checked={checked}
    onSelect={(event) => {
      event.preventDefault();
      onSelect?.(event);
    }}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-md py-2 pl-7 pr-2 text-body text-neutral-800 outline-none",
      "data-[highlighted]:bg-neutral-100",
      className
    )}
    {...props}
  >
    <DropdownMenuPrimitive.ItemIndicator className="absolute left-2 flex size-4 items-center justify-center text-secondary-700">
      <Check className="size-3.5" />
    </DropdownMenuPrimitive.ItemIndicator>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-neutral-200", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
};
