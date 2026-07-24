-- BEFORE running the constraint statements below, find and resolve any
-- existing duplicates first - adding a unique constraint while duplicates
-- exist will fail loudly (which is correct behaviour, but you need to fix
-- the data first). Run this to see the full scope across every client:
--
-- select client_id, invoice_number, count(*), array_agg(id) as invoice_ids
-- from sales_invoices
-- where status != 'void'
-- group by client_id, invoice_number
-- having count(*) > 1;
--
-- For each group found, decide which row keeps the number and manually
-- renumber the others via the invoice edit form (or a targeted update) -
-- this needs a human judgement call, not an automated guess, since only you
-- know which one is the "real" number for a given client's records.

-- Root cause: suggestNextInvoiceNumber() in SalesInvoices.tsx used
-- COUNT(*) + 1 as the next number - not the actual highest number ever
-- issued. Any row removal (e.g. a hard delete during testing/cleanup)
-- shifts that count backward, and the next invoice created then collides
-- with a number already in use. This replaces it with a proper atomic
-- function based on the actual highest numeric suffix issued so far,
-- serialized per client so concurrent creation can't race either.

create or replace function get_next_sales_invoice_number(p_client_id uuid)
returns text
language plpgsql
as $$
declare
  next_num integer;
begin
  -- Serializes concurrent calls for the same client within this transaction,
  -- without needing a separate counter table
  perform pg_advisory_xact_lock(hashtext(p_client_id::text));

  select coalesce(max(substring(invoice_number from 'INV-(\d+)')::integer), 0) + 1
    into next_num
    from sales_invoices
    where client_id = p_client_id
      and invoice_number ~ '^INV-\d+$';

  return 'INV-' || lpad(next_num::text, 4, '0');
end;
$$;

-- Hard backstop - even if the application logic is ever wrong again in the
-- future, the database itself will now refuse a genuine duplicate outright.
-- Voided records are excluded from the check as a deliberate allowance -
-- corrected replacement invoices always get a fresh auto-suggested number
-- rather than reusing the voided one, but this still leaves room for a
-- number to be manually reissued later if that's ever genuinely wanted.
create unique index if not exists uq_sales_invoices_client_number
  on sales_invoices (client_id, invoice_number)
  where status != 'void';

create unique index if not exists uq_purchase_bills_client_number
  on purchase_bills (client_id, bill_number)
  where status != 'void';
