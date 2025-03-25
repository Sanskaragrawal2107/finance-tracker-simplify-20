
-- Add new columns to site_financial_summary
ALTER TABLE site_financial_summary
ADD COLUMN IF NOT EXISTS funds_received_from_supervisor DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS advance_paid_to_supervisor DECIMAL(10,2) DEFAULT 0;

-- Create supervisor_transactions table
CREATE TABLE IF NOT EXISTS supervisor_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payer_supervisor_id UUID REFERENCES users(id),
    receiver_supervisor_id UUID REFERENCES users(id),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('funds_received_from_supervisor', 'advance_paid_to_supervisor')),
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_supervisor_transactions_payer ON supervisor_transactions(payer_supervisor_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_transactions_receiver ON supervisor_transactions(receiver_supervisor_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_transactions_site ON supervisor_transactions(site_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_transactions_date ON supervisor_transactions(date);

-- Add RLS policies
ALTER TABLE supervisor_transactions ENABLE ROW LEVEL SECURITY;

-- Allow users to view supervisor transactions
CREATE POLICY "Users can view supervisor transactions"
    ON supervisor_transactions FOR SELECT
    USING (
        payer_supervisor_id = auth.uid() 
        OR receiver_supervisor_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Allow users to insert supervisor transactions
CREATE POLICY "Users can insert supervisor transactions"
    ON supervisor_transactions FOR INSERT
    WITH CHECK (
        payer_supervisor_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Create function to update financial summary
CREATE OR REPLACE FUNCTION update_supervisor_financial_summary()
RETURNS TRIGGER AS $$
BEGIN
    -- Update payer's financial summary
    UPDATE site_financial_summary
    SET advance_paid_to_supervisor = advance_paid_to_supervisor + NEW.amount
    WHERE site_id = NEW.site_id;

    -- Update receiver's financial summary
    UPDATE site_financial_summary
    SET funds_received_from_supervisor = funds_received_from_supervisor + NEW.amount
    WHERE site_id = NEW.site_id;

    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for financial summary updates
CREATE TRIGGER update_supervisor_financial_summary_trigger
    AFTER INSERT ON supervisor_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_supervisor_financial_summary();

-- Create trigger to update updated_at
CREATE TRIGGER update_supervisor_transactions_updated_at
    BEFORE UPDATE ON supervisor_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 
