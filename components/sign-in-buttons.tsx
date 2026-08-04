"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Code2, Mail } from "lucide-react";
import { getSafeCallbackUrl } from "@/lib/utils";

interface SignInButtonsProps {
  callbackUrl?: string;
}

export function SignInButtons({ callbackUrl }: SignInButtonsProps = {}) {
  const safeUrl = getSafeCallbackUrl(callbackUrl);

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="outline"
        className="w-full"
        onClick={() => signIn("github", { callbackUrl: safeUrl })}
      >
        <Code2 className="mr-2 h-4 w-4" />
        Continue with GitHub
      </Button>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => signIn("google", { callbackUrl: safeUrl })}
      >
        <Mail className="mr-2 h-4 w-4" />
        Continue with Google
      </Button>
    </div>
  );
}
