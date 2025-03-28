-- Script to fix double counting issue in the financial summary
-- Run this script from your database client connected to the Supabase database

-- First, let's view the current values for all sites
SELECT site_id, funds_received, funds_received_from_supervisor, 
       total_expenses_paid, total_advances_paid, advance_paid_to_supervisor, 
       invoices_paid, current_balance
FROM site_financial_summary;

-- Now, update each site's financial summary with correct values

-- Step 1: Create a temporary function to recalculate financial data
CREATE OR REPLACE FUNCTION fix_site_financial_summary(site_id_param UUID)
RETURNS VOID AS $$
DECLARE
  funds_received_total NUMERIC;
  funds_received_from_supervisor_total NUMERIC;
  expenses_total NUMERIC;
  advances_total NUMERIC;
  advance_paid_to_supervisor_total NUMERIC;
  debit_to_worker_total NUMERIC;
  invoices_paid_total NUMERIC;
  current_balance_val NUMERIC;
BEGIN
  -- Calculate funds received from HO
  SELECT COALESCE(SUM(amount), 0) INTO funds_received_total
  FROM funds_received
  WHERE site_id = site_id_param;
  
  -- Calculate funds received from other supervisors
  SELECT COALESCE(SUM(amount), 0) INTO funds_received_from_supervisor_total
  FROM supervisor_transactions
  WHERE receiver_site_id = site_id_param AND transaction_type = 'funds_received';
  
  -- Calculate total expenses
  SELECT COALESCE(SUM(amount), 0) INTO expenses_total
  FROM expenses
  WHERE site_id = site_id_param;
  
  -- Calculate total advances (excluding debit to worker items)
  SELECT COALESCE(SUM(amount), 0) INTO advances_total
  FROM advances
  WHERE site_id = site_id_param AND purpose = 'advance';
  
  -- Calculate advance paid to other supervisors
  SELECT COALESCE(SUM(amount), 0) INTO advance_paid_to_supervisor_total
  FROM supervisor_transactions
  WHERE payer_site_id = site_id_param AND transaction_type = 'advance_paid';
  
  -- Calculate debit to worker (tools, others, safety_shoes)
  SELECT COALESCE(SUM(amount), 0) INTO debit_to_worker_total
  FROM advances
  WHERE site_id = site_id_param AND purpose IN ('tools', 'safety_shoes', 'other');
  
  -- Calculate invoices paid by supervisor
  SELECT COALESCE(SUM(net_amount), 0) INTO invoices_paid_total
  FROM site_invoices
  WHERE site_id = site_id_param AND payment_status = 'paid' AND approver_type = 'supervisor';
  
  -- Calculate current balance using the correct formula
  current_balance_val := (funds_received_total + funds_received_from_supervisor_total) - 
                         (expenses_total + advances_total + invoices_paid_total + advance_paid_to_supervisor_total);
  
  -- Update the site financial summary
  UPDATE site_financial_summary SET
    funds_received = funds_received_total,
    funds_received_from_supervisor = funds_received_from_supervisor_total, 
    total_expenses_paid = expenses_total,
    total_advances_paid = advances_total,
    advance_paid_to_supervisor = advance_paid_to_supervisor_total,
    invoices_paid = invoices_paid_total,
    debit_to_worker = debit_to_worker_total,
    current_balance = current_balance_val,
    last_updated = now()
  WHERE site_id = site_id_param;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Run the function for each site
DO $$
DECLARE
  site_record RECORD;
BEGIN
  FOR site_record IN SELECT id FROM sites LOOP
    PERFORM fix_site_financial_summary(site_record.id);
  END LOOP;
END;
$$;

-- Step 3: View the updated values
SELECT site_id, funds_received, funds_received_from_supervisor, 
       total_expenses_paid, total_advances_paid, advance_paid_to_supervisor, 
       invoices_paid, current_balance
FROM site_financial_summary;

-- Step 4: Drop the temporary function
DROP FUNCTION IF EXISTS fix_site_financial_summary; 