-- Enable trigram extension for fast ILIKE / text search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for snippet live search.
CREATE INDEX IF NOT EXISTS snippet_title_trgm
  ON "Snippet" USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS snippet_code_trgm
  ON "Snippet" USING gin (code gin_trgm_ops);

-- GIN trigram index for tag search.
CREATE INDEX IF NOT EXISTS tag_name_trgm
  ON "Tag" USING gin (name gin_trgm_ops);
