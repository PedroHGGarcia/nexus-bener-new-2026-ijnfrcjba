-- Cleanup: remove the temporary restore scratch table used to
-- stage the full v0.0.158 ProposalDocument.tsx recovered from GitHub.
drop table if exists public.proposal_doc_restore;
