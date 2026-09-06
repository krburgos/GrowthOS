import { ImageUploadCircle } from "@/components/settings/image-upload-circle";

/**
 * contacts.avatar_url — client-confirmed third exception to the "no
 * file attachments in Phase 1" line (Backend Schema §12), added for the
 * Contact Detail redesign. Same shape as the company logo/user avatar
 * uploads: the `contact-avatars` bucket namespaces objects by
 * account_id (not contact_id) as the first path segment, matching the
 * contact_avatars_insert/update/delete RLS policies, since any of a
 * contact's edit-capable roles may upload its photo, not just one user.
 */
export function ContactAvatarUpload({
  contactId,
  accountId,
  avatarUrl,
  canEdit,
  initials,
}: {
  contactId: string;
  accountId: string;
  avatarUrl: string | null;
  canEdit: boolean;
  initials: string;
}) {
  return (
    <ImageUploadCircle
      bucket="contact-avatars"
      folder={`${accountId}/${contactId}`}
      table="contacts"
      idColumn="id"
      idValue={contactId}
      urlColumn="avatar_url"
      currentUrl={avatarUrl}
      canEdit={canEdit}
      ariaLabel="Upload contact photo"
      fallback={<span className="text-h4 font-semibold text-white">{initials}</span>}
    />
  );
}
