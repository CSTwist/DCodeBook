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
import { Code2, Search, Users } from "lucide-react";

const features = [
  { icon: Code2, label: "Syntax highlighting" },
  { icon: Search, label: "Fast search & tags" },
  { icon: Users, label: "Team collections" },
];

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen">
      <section className="hidden w-1/2 flex-col justify-between bg-muted/40 p-12 md:flex">
        <div className="flex items-center gap-2">
          <Code2 className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">DCodeBook</span>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            DCodeBook
          </h1>
          <p className="max-w-md text-lg text-muted-foreground">
            Your developer knowledge base. Capture, search, and share code
            snippets.
          </p>

          <ul className="space-y-3">
            {features.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-medium">{label}</span>
              </li>
            ))}
          </ul>

          <pre
            style={{
              margin: 0,
              padding: "1rem",
              borderRadius: "0.75rem",
              background: "#0d1117",
              color: "#e6edf3",
              fontSize: "0.8rem",
              lineHeight: 1.6,
              overflowX: "auto",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            }}
          >
            <code>{`// Save a snippet in seconds
const snippet = await db.snippet.create({
  data: {
    title: "Debounce",
    language: "typescript",
    code: debounce.toString(),
    tags: { connect: [{ name: "utils" }] },
  },
});`}</code>
          </pre>
        </div>

        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} DCodeBook
        </p>
      </section>

      <section className="flex w-full items-center justify-center p-4 md:w-1/2">
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
      </section>
    </main>
  );
}
