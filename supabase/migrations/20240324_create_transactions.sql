-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('expense', 'advance', 'funds_received', 'invoice')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_site_id ON transactions(site_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- Add RLS policies
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Allow users to view transactions for their sites
CREATE POLICY "Users can view transactions for their sites"
    ON transactions FOR SELECT
    USING (
        site_id IN (
            SELECT id FROM sites 
            WHERE supervisor_id = auth.uid() 
            OR created_by = auth.uid()
        )
    );

-- Allow users to insert transactions for their sites
CREATE POLICY "Users can insert transactions for their sites"
    ON transactions FOR INSERT
    WITH CHECK (
        site_id IN (
            SELECT id FROM sites 
            WHERE supervisor_id = auth.uid() 
            OR created_by = auth.uid()
        )
    );

-- Allow users to update their own transactions
CREATE POLICY "Users can update their own transactions"
    ON transactions FOR UPDATE
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Allow users to delete their own transactions
CREATE POLICY "Users can delete their own transactions"
    ON transactions FOR DELETE
    USING (created_by = auth.uid());

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 