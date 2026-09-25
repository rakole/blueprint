CREATE TABLE shelf_assignments (
  box_id VARCHAR(32) PRIMARY KEY,
  depot_code VARCHAR(16) NOT NULL,
  shelf_code VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL
);

CREATE INDEX shelf_assignments_depot ON shelf_assignments (depot_code, status);
