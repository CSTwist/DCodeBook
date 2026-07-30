"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Code2, Mail } from "lucide-react";

export function SignInButtons() {
  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="outline"
        className="w-full"
        onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
      >
        <Code2 className="mr-2 h-4 w-4" />
        Continue with GitHub
      </Button>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
      >
        <Mail className="mr-2 h-4 w-4" />
        Continue with Google
      </Button>
    </div>
  );
}
