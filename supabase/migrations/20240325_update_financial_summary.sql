
-- Drop existing view if it exists
DROP VIEW IF EXISTS site_financial_summary;

-- Create updated view with new transaction types
CREATE VIEW site_financial_summary AS
SELECT 
    s.id as site_id,
    s.name as site_name,
    s.location,
    s.supervisor_id,
    u.name as supervisor_name,
    COALESCE(SUM(CASE WHEN t.type = 'funds_received' THEN t.amount ELSE 0 END), 0) as funds_received,
    COALESCE(SUM(CASE WHEN t.type = 'funds_received_from_supervisor' THEN t.amount ELSE 0 END), 0) as funds_received_from_supervisor,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expenses,
    COALESCE(SUM(CASE WHEN t.type = 'advance' THEN t.amount ELSE 0 END), 0) as total_advances,
    COALESCE(SUM(CASE WHEN t.type = 'invoice' THEN t.amount ELSE 0 END), 0) as total_invoices,
    COALESCE(SUM(CASE WHEN t.type = 'advance_paid_to_supervisor' THEN t.amount ELSE 0 END), 0) as advance_paid_to_supervisor,
    (
        COALESCE(SUM(CASE WHEN t.type = 'funds_received' THEN t.amount ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN t.type = 'funds_received_from_supervisor' THEN t.amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.type = 'advance' THEN t.amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.type = 'invoice' THEN t.amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.type = 'advance_paid_to_supervisor' THEN t.amount ELSE 0 END), 0)
    ) as current_balance
FROM sites s
LEFT JOIN users u ON s.supervisor_id = u.id
LEFT JOIN transactions t ON s.id = t.site_id
GROUP BY s.id, s.name, s.location, s.supervisor_id, u.name;

-- Grant access to the view
GRANT SELECT ON site_financial_summary TO authenticated; 

-- Create trigger to update financial summary after supervisor transactions
CREATE OR REPLACE FUNCTION update_supervisor_financial_summary()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.transaction_type = 'advance_paid' THEN
        -- Update payer's site (reduce funds)
        UPDATE site_financial_summary
        SET advance_paid_to_supervisor = advance_paid_to_supervisor + NEW.amount
        WHERE site_id = NEW.payer_site_id;
        
        -- Update receiver's site (add funds)
        UPDATE site_financial_summary
        SET funds_received_from_supervisor = funds_received_from_supervisor + NEW.amount
        WHERE site_id = NEW.receiver_site_id;
    ELSIF NEW.transaction_type = 'funds_received' THEN
        -- Update payer's site (reduce funds)
        UPDATE site_financial_summary
        SET funds_received_from_supervisor = funds_received_from_supervisor + NEW.amount
        WHERE site_id = NEW.payer_site_id;
        
        -- Update receiver's site (add funds)
        UPDATE site_financial_summary
        SET advance_paid_to_supervisor = advance_paid_to_supervisor + NEW.amount
        WHERE site_id = NEW.receiver_site_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for supervisor transaction inserts
CREATE TRIGGER update_supervisor_financial_summary_trigger
AFTER INSERT ON supervisor_transactions
FOR EACH ROW
EXECUTE FUNCTION update_supervisor_financial_summary();
