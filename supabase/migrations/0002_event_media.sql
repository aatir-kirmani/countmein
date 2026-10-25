-- Event media: cover image (required) + gallery images + one optional cover video.
alter table public.events add column if not exists gallery_urls text[] not null default '{}';
alter table public.events add column if not exists video_url text;
alter table public.events add constraint events_cover_required check (cover_url is not null and cover_url <> '');
alter table public.events add constraint events_gallery_max check (coalesce(array_length(gallery_urls, 1), 0) <= 10);

-- Allow larger uploads (videos) in the media bucket; images are capped client-side.
update storage.buckets set file_size_limit = 52428800 where id = 'media';
