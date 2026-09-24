import { User } from "lucide-react";

import { ImageUploadCircle } from "@/components/settings/image-upload-circle";

/**
 * users.avatar_url existed in the original schema (Backend Schema §5.2)
 * but was never wired up — client-confirmed to make it a real upload,
 * same shape as the company logo (avatars bucket, public read, write
 * restricted to the owning user only — see the avatar_storage
 * migration).
 *
 * `compact` and `onDark` are separate on purpose (fixed 2026-09-24). They
 * used to be one flag, which meant the profile hero could not have a small
 * camera button without also getting the styling for a dark ground — and
 * choosing the other way round put a 36px button on a 64px circle, covering
 * most of the avatar, with grey initials that all but vanished behind it.
 * One flag sizes the button; the other says what it is sitting on.
 */
export function ProfileAvatarUpload({
  userId,
  avatarUrl,
  fallbackText,
  compact,
  onDark,
}: {
  userId: string;
  avatarUrl: string | null;
  fallbackText: string;
  /** Shrinks the camera button, for circles under about 80px. */
  compact?: boolean;
  /** The circle sits on a dark ground, so the empty state needs light ink. */
  onDark?: boolean;
}) {
  return (
    <ImageUploadCircle
      bucket="avatars"
      folder={userId}
      table="users"
      idColumn="id"
      idValue={userId}
      urlColumn="avatar_url"
      currentUrl={avatarUrl}
      canEdit
      compact={compact}
      ariaLabel="Upload profile picture"
      fallback={
        fallbackText ? (
          <span className={`text-h4 font-bold ${onDark ? "text-white" : "text-neutral-500"}`}>{fallbackText}</span>
        ) : (
          <User className={`size-1/2 ${onDark ? "text-white/70" : "text-neutral-400"}`} />
        )
      }
    />
  );
}
