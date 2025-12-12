-- Buchhaltung Database Initialization Script
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create ENUM types
CREATE TYPE user_role AS ENUM ('ADMIN', 'USER');
CREATE TYPE payment_method_type AS ENUM ('PayPal', 'SEPA', 'CASH', 'BANK');
CREATE TYPE art_type AS ENUM ('PP', 'EB', 'EK', 'WB');
CREATE TYPE interval_type AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'yearly');
CREATE TYPE category_key_type AS ENUM ('lebensmittel', 'hygiene', 'mobilitaet', 'kommunikation', 'gesundheit', 'haus', 'strom', 'gas', 'wasser', 'gemeinde', 'hobby', 'sonstiges');
CREATE TYPE file_kind_type AS ENUM ('invoice', 'receipt');

-- Table: users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'USER',
    pages JSONB NOT NULL DEFAULT '["dashboard", "transactions", "recurring", "paypal", "paypalneu", "reports", "charts", "admin", "categories"]'::jsonb,
    accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create unique case-insensitive index on username
CREATE UNIQUE INDEX idx_users_username_lower ON users (LOWER(username));

-- Table: accounts
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    description VARCHAR(1000) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    payment_method payment_method_type NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(50),
    note VARCHAR(2000),
    category VARCHAR(100),
    art art_type NOT NULL,
    booked_on_giro BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    extra_data JSONB
);

-- Table: recurring
CREATE TABLE recurring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    description VARCHAR(1000) NOT NULL,
    interval interval_type NOT NULL,
    interval_count INTEGER NOT NULL DEFAULT 1 CHECK (interval_count >= 1),
    start_date DATE NOT NULL,
    end_date DATE,
    day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
    occurrence_amount NUMERIC(15, 2) NOT NULL,
    monthly_rate NUMERIC(15, 2) GENERATED ALWAYS AS (occurrence_amount) STORED,
    total_remaining NUMERIC(15, 2),
    last_installment NUMERIC(15, 2),
    remaining_installments INTEGER CHECK (remaining_installments >= 1),
    note VARCHAR(2000),
    category VARCHAR(100),
    payment_method payment_method_type NOT NULL,
    recurring BOOLEAN NOT NULL DEFAULT true,
    art art_type NOT NULL,
    booked_on_giro BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    extra_data JSONB,
    CONSTRAINT check_end_date_after_start CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Table: regular_bookings
CREATE TABLE regular_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    description VARCHAR(1000) NOT NULL,
    art art_type NOT NULL CHECK (art IN ('WB', 'EK')),
    start_date DATE NOT NULL,
    end_date DATE,
    booking_date DATE,
    interval interval_type NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    category VARCHAR(100),
    normalized_monthly_amount NUMERIC(15, 2),
    booked_on_giro BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    extra_data JSONB,
    CONSTRAINT check_rb_end_date_after_start CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Table: categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key category_key_type NOT NULL UNIQUE,
    label VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL CHECK (color ~ '^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$'),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: files
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type VARCHAR(50) NOT NULL DEFAULT 'transaction',
    owner_id UUID NOT NULL,
    kind file_kind_type NOT NULL,
    mime VARCHAR(100) NOT NULL,
    size INTEGER NOT NULL,
    filename_original VARCHAR(255) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_recurring_account_id ON recurring(account_id);
CREATE INDEX idx_regular_bookings_account_id ON regular_bookings(account_id);
CREATE INDEX idx_files_owner ON files(owner_type, owner_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_updated_at BEFORE UPDATE ON recurring
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_regular_bookings_updated_at BEFORE UPDATE ON regular_bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial categories
INSERT INTO categories (id, key, label, color, active) VALUES
(gen_random_uuid(), 'lebensmittel', 'Lebensmittel', '#4CAF50', true),
(gen_random_uuid(), 'hygiene', 'Hygiene', '#2196F3', true),
(gen_random_uuid(), 'mobilitaet', 'Mobilität', '#FF9800', true),
(gen_random_uuid(), 'kommunikation', 'Kommunikation', '#9C27B0', true),
(gen_random_uuid(), 'gesundheit', 'Gesundheit', '#F44336', true),
(gen_random_uuid(), 'haus', 'Haus', '#795548', true),
(gen_random_uuid(), 'strom', 'Strom', '#FFEB3B', true),
(gen_random_uuid(), 'gas', 'Gas', '#FF5722', true),
(gen_random_uuid(), 'wasser', 'Wasser', '#00BCD4', true),
(gen_random_uuid(), 'gemeinde', 'Gemeinde', '#607D8B', true),
(gen_random_uuid(), 'hobby', 'Hobby', '#E91E63', true),
(gen_random_uuid(), 'sonstiges', 'Sonstiges', '#9E9E9E', true);
