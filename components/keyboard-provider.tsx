"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-medium">
        {keys}
      </kbd>
    </div>
  );
}

export function KeyboardProvider() {
  const { helpOpen, setHelpOpen } = useKeyboardShortcuts();

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Quick actions available anywhere in the app.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <Shortcut keys="⌘/Ctrl + K" label="Open command palette" />
          <Shortcut keys="/" label="Focus search" />
          <Shortcut keys="n" label="New snippet" />
          <Shortcut keys="?" label="Show this help" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
