"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { addMember, removeMember } from "@/actions/collections";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, Trash2, Loader2, UserPlus } from "lucide-react";

interface MemberItem {
  id: string;
  role: "VIEWER" | "EDITOR" | "ADMIN";
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface CollectionMembersProps {
  collectionId: string;
  members: MemberItem[];
  canEdit: boolean;
}

export function CollectionMembers({
  collectionId,
  members,
  canEdit,
}: CollectionMembersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"VIEWER" | "EDITOR" | "ADMIN">("VIEWER");

  function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", email.trim());
      formData.append("role", role);

      const res = await addMember(collectionId, formData);
      if ("error" in res && res.error) {
        toast.error(
          typeof res.error === "string" ? res.error : "Failed to add member"
        );
      } else {
        toast.success("Member added");
        setEmail("");
        router.refresh();
      }
    });
  }

  function handleRemoveMember(userId: string) {
    startTransition(async () => {
      const res = await removeMember(collectionId, userId);
      if ("error" in res && res.error) {
        toast.error(
          typeof res.error === "string" ? res.error : "Failed to remove member"
        );
      } else {
        toast.success("Member removed");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" /> Team Members
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit && (
          <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              placeholder="User email address..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              required
            />
            <Select
              value={role}
              onValueChange={(val) =>
                setRole(val as "VIEWER" | "EDITOR" | "ADMIN")
              }
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VIEWER">Viewer</SelectItem>
                <SelectItem value="EDITOR">Editor</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-1" />
              )}
              Add
            </Button>
          </form>
        )}

        <div className="divide-y rounded-md border">
          {members.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground text-center">
              No team members added yet.
            </p>
          ) : (
            members.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium">{m.user.name || m.user.email}</p>
                  <p className="text-xs text-muted-foreground">{m.user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{m.role}</Badge>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemoveMember(m.user.id)}
                      disabled={isPending}
                      aria-label={`Remove ${m.user.name || m.user.email}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
