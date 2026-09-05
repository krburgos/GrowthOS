import { User } from "lucide-react";

import { ImageUploadCircle } from "@/components/settings/image-upload-circle";

/**
 * users.avatar_url existed in the original schema (Backend Schema §5.2)
 * but was never wired up — client-confirmed to make it a real upload,
 * same shape as the company logo (avatars bucket, public read, write
 * restricted to the owning user only — see the avatar_storage
 * migration).
 */
export function ProfileAvatarUpload({
  userId,
  avatarUrl,
  fallbackText,
}: {
  userId: string;
  avatarUrl: string | null;
  fallbackText: string;
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
      ariaLabel="Upload profile picture"
      fallback={
        fallbackText ? (
          <span className="text-h3 font-medium text-neutral-500">{fallbackText}</span>
        ) : (
          <User className="size-1/2 text-neutral-400" />
        )
      }
    />
  );
}
