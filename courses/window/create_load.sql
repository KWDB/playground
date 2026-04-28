CREATE TS DATABASE ts_window;

CREATE TABLE ts_window.vehicles (
  ts timestamp NOT NULL,
  vehicle_id varchar(16),
  speed float,
  lane_no int
) TAGS (
  location int NOT NULL
)
PRIMARY TAGS(location);

import into ts_window.vehicles CSV DATA ("nodelocal://1/vehicles");
