import { cn } from "@/lib/utils";
import type { TeamMember } from "@/types";

interface AssigneeAvatarProps {
  member?: TeamMember;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
}

export function AssigneeAvatar({
  member,
  size = "sm",
  showName = false,
}: AssigneeAvatarProps) {
  if (!member) {
    return (
      <span className="text-xs text-gray-400 italic">Unassigned</span>
    );
  }

  const sizes = {
    sm: "h-6 w-6 text-[10px]",
    md: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm",
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-medium text-white shrink-0",
          sizes[size],
        )}
        style={{ backgroundColor: member.color }}
        title={`${member.name} — ${member.role}`}
      >
        {member.avatar}
      </div>
      {showName && (
        <span className="text-sm text-gray-700 truncate">{member.name}</span>
      )}
    </div>
  );
}

export function AssigneeStack({ members }: { members: TeamMember[] }) {
  return (
    <div className="flex -space-x-2">
      {members.slice(0, 4).map((member) => (
        <div
          key={member.id}
          className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-medium text-white border-2 border-white"
          style={{ backgroundColor: member.color }}
          title={member.name}
        >
          {member.avatar}
        </div>
      ))}
      {members.length > 4 && (
        <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-medium text-gray-600 bg-gray-100 border-2 border-white">
          +{members.length - 4}
        </div>
      )}
    </div>
  );
}
