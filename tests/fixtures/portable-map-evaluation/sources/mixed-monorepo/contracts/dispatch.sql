CREATE TABLE dispatches (
  dispatch_id VARCHAR(32) PRIMARY KEY,
  box_id VARCHAR(32) NOT NULL,
  depot_code VARCHAR(16) NOT NULL,
  route_date DATE NOT NULL,
  status VARCHAR(16) NOT NULL
);

CREATE INDEX dispatches_depot_date ON dispatches (depot_code, route_date);
