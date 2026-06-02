CREATE TS DATABASE sensors;

CREATE TABLE sensors.sensor_data (
  ts timestamp NOT NULL,
  normal_time timestamp NOT NULL,
  temperature smallint,
  temperature2 int,
  temperature3 bigint,
  stress float4,
  stress2 double
) TAGS (
  ptagID int NOT NULL
)
PRIMARY TAGS(ptagID);

import into sensors.sensor_data CSV DATA ("nodelocal://1/sensors");
