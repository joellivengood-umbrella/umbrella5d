-- Title: Lock the avatars bucket to safe image types
--
-- The avatars bucket (profile pictures + partner logos) is public and was
-- created with no allowed_mime_types and no file_size_limit, while the upload
-- code sets the Content-Type from the (client-controlled) file. A user could
-- upload an SVG/HTML file (image/svg+xml) into their own folder and have it
-- served from the public bucket — a stored-XSS / drive-by vector. Restrict to
-- raster image types (notably NOT svg) and cap the size.
--
-- Existing objects are unaffected; this only constrains future uploads. The
-- client-side extension check stays as UX, but this is the real boundary.
--
-- Idempotent.

update storage.buckets
   set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
       file_size_limit    = 5242880  -- 5 MB, matches the client-side check
 where id = 'avatars';
