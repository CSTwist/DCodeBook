import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignInButtons } from "@/components/sign-in-buttons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to DCodeBook</CardTitle>
          <CardDescription>
            Save and share your code snippets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInButtons />
        </CardContent>
      </Card>
    </main>
  );
}
