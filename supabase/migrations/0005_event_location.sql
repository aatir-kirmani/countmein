-- Help attendees find the venue: a map link plus free-form directions.
alter table public.events add column if not exists maps_url text;
alter table public.events add column if not exists location_details text;
alter table public.events add constraint events_maps_url_https check (maps_url is null or maps_url ~ '^https://');
alter table public.events add constraint events_location_details_len check (location_details is null or char_length(location_details) <= 500);
