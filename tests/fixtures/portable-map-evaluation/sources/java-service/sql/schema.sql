-- Illustrative schema for a future persistence adapter; the baseline uses memory.
CREATE TABLE locker (
    locker_id VARCHAR(32) PRIMARY KEY,
    locker_size VARCHAR(16) NOT NULL,
    zone VARCHAR(32) NOT NULL,
    parcel_tracking_id VARCHAR(64) NULL
);

CREATE TABLE delivery (
    tracking_id VARCHAR(64) PRIMARY KEY,
    recipient_id VARCHAR(64) NOT NULL,
    locker_size VARCHAR(16) NOT NULL,
    zone VARCHAR(32) NOT NULL,
    pickup_code_hash VARCHAR(128) NOT NULL,
    status VARCHAR(24) NOT NULL,
    locker_id VARCHAR(32) NULL,
    pickup_deadline TIMESTAMP WITH TIME ZONE NULL,
    CONSTRAINT delivery_locker_fk FOREIGN KEY (locker_id) REFERENCES locker(locker_id)
);
